<?php
/**
 * Plugin Name: FINN DEV Dashboard
 * Description: Central dashboard for managing and updating internal Finn Partners plugins via FINN Licensing API.
 * Version: 2.0.2
 * Author: Finn Partners
 * Author URI: https://finnpartners.com/
 * Requires PHP: 8.0
 * License: GNU General Public License v3 or later
 * License URI: http://www.gnu.org/licenses/gpl-3.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class FP_Dev_Dashboard {

    private $api_base_url    = 'https://wplicense.finnpartners.com/api';
    private $option_name     = 'finn_updater_settings';
    private $installing_slug = '';
    private $product_slugs   = null;

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_finn_dev_menu' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_dashboard_assets' ] );

        add_action( 'admin_post_finn_install_plugin', [ $this, 'handle_plugin_installation' ] );

        add_filter( 'pre_set_site_transient_update_plugins', [ $this, 'check_for_updates' ] );
        add_filter( 'plugins_api', [ $this, 'plugin_popup_info' ], 10, 3 );
        add_filter( 'upgrader_source_selection', [ $this, 'fix_folder_name' ], 10, 4 );

        add_action( 'finn_dev_daily_license_check', [ $this, 'verify_license_status' ] );
        if ( ! wp_next_scheduled( 'finn_dev_daily_license_check' ) ) {
            wp_schedule_event( time(), 'daily', 'finn_dev_daily_license_check' );
        }

        add_action( 'admin_init', [ $this, 'trigger_manual_heartbeat' ] );
        add_action( 'admin_notices', [ $this, 'show_license_notice' ] );
    }

    private function get_plugin_slug( string $file ): string {
        return dirname( $file );
    }

    private function is_finn_plugin( string $file ): bool {
        $slug = $this->get_plugin_slug( $file );
        return str_starts_with( $slug, 'fp-' );
    }

    private function get_fingerprint() {
        $domain = parse_url( home_url(), PHP_URL_HOST );
        return str_replace( 'www.', '', $domain );
    }

    private function get_settings() {
        return wp_parse_args( get_option( $this->option_name, [] ), [
                'api_key'     => '',
                'license_key' => ''
        ]);
    }

    public function enqueue_dashboard_assets($hook) {
        if (strpos($hook, 'finn-dev') === false) return;
        ?>
        <style>
            .fd-wrap { margin: 20px 20px 0 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .wrap h1.fd-main-title { color: #333 !important; margin: 30px 0 !important; padding: 0 !important; text-align: left !important; font-weight: bold !important; font-size: 32px !important; line-height: 1 !important; }
            .fd-hero { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 30px; display: flex; align-items: center; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
            .fd-hero-logo { width: 60px; height: 60px; background: #113c6f; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 30px; color: #fff; }
            .fd-hero-logo .dashicons { font-size: 32px; width: 32px; height: 32px; }
            .fd-stat-item { margin-right: 60px; }
            .fd-stat-number { font-size: 36px; font-weight: 300; display: block; line-height: 1; color: #333; }
            .fd-stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 5px; display: block; }
            .fd-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 30px; align-items: start; }
            .fd-panel { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); overflow: hidden; }
            .fd-panel-header { padding: 20px 25px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; }
            .fd-panel-header h2 { margin: 0; font-size: 14px; font-weight: 600; color: #333; display: flex; align-items: center; text-transform: uppercase; letter-spacing: 0.5px; }
            .fd-panel-header h2 .dashicons { margin-right: 12px; font-size: 18px; width: 18px; height: 18px; color: #999; }
            .fd-plugin-row { display: flex; align-items: center; padding: 18px 25px; border-bottom: 1px solid #f7f7f7; }
            .fd-plugin-row:last-child { border-bottom: none; }
            .fd-btn { padding: 8px 18px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: 700; cursor: pointer; border: none; text-transform: uppercase; background: #00a0d2; color: #fff; }
            .fd-btn:hover { background: #008ebc; color: #fff; }
            .fd-update-badge { background: #fff8e5; color: #856404; border: 1px solid #ffeeba; font-size: 10px; padding: 2px 8px; border-radius: 12px; margin-left: 10px; font-weight: 700; text-transform: lowercase; }
        </style>
        <?php
    }

    public function register_finn_dev_menu() {
        $current_user = wp_get_current_user();
        if ( ! $current_user || ! str_ends_with( $current_user->user_email, '@finnpartners.com' ) ) return;

        add_menu_page('FINN DEV Dashboard', 'FINN DEV', 'manage_options', 'finn-dev', [$this, 'render_dashboard'], 'dashicons-cloud', 80);
        add_submenu_page('finn-dev', 'FINN DEV Dashboard', 'Dashboard', 'manage_options', 'finn-dev', [$this, 'render_dashboard']);
        add_submenu_page('finn-dev', 'FINN DEV Settings', 'Settings', 'manage_options', 'finn-dev-settings', [$this, 'render_settings']);
    }

    public function render_dashboard() {
        if ( isset( $_GET['page'] ) && $_GET['page'] === 'finn-dev' ) {
            delete_site_transient( 'update_plugins' );
            wp_update_plugins();
        }

        $all_plugins = get_plugins();
        $installed_finn = [];
        $update_count = 0;
        $installed_slugs = [];

        foreach($all_plugins as $file => $data) {
            if ( ! $this->is_finn_plugin( $file ) ) continue;

            $slug = $this->get_plugin_slug( $file );
            $transient = get_site_transient('update_plugins');
            $has_update = isset($transient->response[$file]);
            $data['file'] = $file;
            $data['has_update'] = $has_update;
            $installed_finn[] = $data;
            $installed_slugs[] = $slug;
            if ($has_update) $update_count++;
        }

        $settings = $this->get_settings();
        $available_products = [];

        if ( !empty($settings['api_key']) ) {
            $response = wp_remote_get("{$this->api_base_url}/products", [
                    'headers' => [ 'Authorization' => 'Bearer ' . $settings['api_key'], 'Accept' => 'application/json' ]
            ]);
            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                $body = json_decode(wp_remote_retrieve_body($response));
                $available_products = $body->data ?? [];
            }
        }
        $description_map = [];
        foreach ($available_products as $product) {
            if (!empty($product->description)) {
                $description_map[$product->slug] = $product->description;
            }
        }
        ?>
        <div class="wrap fd-wrap">
            <h1 class="fd-main-title">Dashboard</h1>
            <div class="fd-hero">
                <div class="fd-hero-logo"><span class="dashicons dashicons-cloud"></span></div>
                <div class="fd-stat-item">
                    <span class="fd-stat-number"><?php echo count($installed_finn); ?></span>
                    <span class="fd-stat-label">Installed Plugins</span>
                </div>
                <div class="fd-stat-item">
                    <span class="fd-stat-number" style="color: <?php echo $update_count > 0 ? '#ffb900' : '#333'; ?>"><?php echo $update_count; ?></span>
                    <span class="fd-stat-label">Updates Available</span>
                </div>
            </div>

            <div class="fd-grid">
                <div class="fd-panel">
                    <div class="fd-panel-header"><h2><span class="dashicons dashicons-admin-plugins"></span> Plugins</h2></div>
                    <div class="fd-panel-content">
                        <?php foreach($installed_finn as $plugin): ?>
                            <?php $slug = $this->get_plugin_slug($plugin['file']); ?>
                            <div class="fd-plugin-row">
                                <div style="flex-grow:1;">
                                    <strong style="font-size:14px; color:#333;"><?php echo esc_html($plugin['Name']); ?></strong>
                                    <span style="font-size:11px; color:#999; margin-left:8px;">v<?php echo esc_html($plugin['Version']); ?></span>
                                    <?php if ($plugin['has_update']): ?><span class="fd-update-badge">update available</span><?php endif; ?>
                                    <?php if (!empty($description_map[$slug])): ?>
                                        <div style="font-size:12px; color:#888; margin-top:4px; line-height:1.4;"><?php echo esc_html($description_map[$slug]); ?></div>
                                    <?php endif; ?>
                                </div>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <a href="<?php echo esc_url('https://github.com/finnpartners/' . $slug); ?>" target="_blank" rel="noopener noreferrer" title="View on GitHub" style="color:#999; text-decoration:none; display:flex; align-items:center;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                                    </a>
                                    <?php if ($plugin['has_update']): ?>
                                        <a href="<?php echo admin_url('update-core.php'); ?>" class="dashicons dashicons-download" style="color:#00a0d2; text-decoration:none; font-size:20px;"></a>
                                    <?php else: ?>
                                        <span class="dashicons dashicons-yes-alt" style="color:#46b450; font-size:20px;"></span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <?php foreach($available_products as $product):
                            if (in_array($product->slug, $installed_slugs)) continue; ?>
                            <div class="fd-plugin-row">
                                <div style="flex-grow:1;">
                                    <strong style="font-size:14px; color:#333;"><?php echo esc_html($product->name); ?></strong>
                                    <?php if (!empty($product->description)): ?>
                                        <div style="font-size:12px; color:#888; margin-top:4px; line-height:1.4;"><?php echo esc_html($product->description); ?></div>
                                    <?php endif; ?>
                                </div>
                                <div style="display:flex;align-items:center;gap:10px;">
                                    <a href="<?php echo esc_url('https://github.com/finnpartners/' . $product->slug); ?>" target="_blank" rel="noopener noreferrer" title="View on GitHub" style="color:#999; text-decoration:none; display:flex; align-items:center;">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                                    </a>
                                    <a href="<?php echo esc_url(admin_url('admin-post.php?action=finn_install_plugin&slug=' . urlencode($product->slug) . '&nonce=' . wp_create_nonce('finn_install'))); ?>" class="fd-btn">Install</a>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <?php if (empty($settings['api_key'])): ?>
                            <div style="padding: 15px 25px; font-size: 12px; color: #888; background: #fafafa;">
                                Add a Global API Key in Settings to browse and install new plugins directly from here.
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    public function verify_license_status() {
        $settings = $this->get_settings();
        if ( empty( $settings['license_key'] ) ) {
            update_option( 'finn_license_valid', false );
            return;
        }

        $response = wp_remote_post( "{$this->api_base_url}/validate", [
                'headers' => [ 'Accept' => 'application/json', 'Content-Type' => 'application/json' ],
                'body'    => wp_json_encode([
                        'key'         => $settings['license_key'],
                        'fingerprint' => $this->get_fingerprint()
                ])
        ]);

        if ( is_wp_error( $response ) ) return;

        $body = json_decode( wp_remote_retrieve_body( $response ) );

        $valid = isset( $body->data->valid ) && $body->data->valid === true;
        update_option( 'finn_license_valid', $valid );
    }

    public function show_license_notice() {
        if ( get_option( 'finn_license_valid', true ) ) return;
        echo '<div class="notice notice-error"><p><strong>Your FINN license is inactive. Plugin updates are disabled. Contact Finn Partners.</strong></p></div>';
    }

    public function trigger_manual_heartbeat() {
        if ( isset($_GET['finn_force_license_check']) && current_user_can('manage_options') ) {
            $this->verify_license_status();
            wp_die('FINN license check triggered.');
        }
    }

    public function check_for_updates( $transient ) {
        if ( empty( $transient->checked ) ) return $transient;
        if ( ! get_option( 'finn_license_valid', true ) ) return $transient;

        $plugins = get_plugins();
        $settings = $this->get_settings();

        foreach ( $plugins as $file => $data ) {
            if ( ! $this->is_finn_plugin( $file ) ) continue;

            $slug = $this->get_plugin_slug( $file );

            $url = add_query_arg([
                    'slug'        => $slug,
                    'license'     => $settings['license_key'] ?? '',
                    'fingerprint' => $this->get_fingerprint(),
                    'version'     => $data['Version']
            ], "{$this->api_base_url}/update-check");

            $response = wp_remote_get( $url, [ 'timeout' => 15 ] );
            if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) continue;

            $update_data = json_decode( wp_remote_retrieve_body( $response ) );

            if ( isset( $update_data->version ) && version_compare( $update_data->version, $data['Version'], '>' ) ) {
                $obj = new stdClass();
                $obj->slug = $slug;
                $obj->plugin = $file;
                $obj->new_version = $update_data->version;
                $obj->package = $update_data->download_url ?? '';

                if ( isset( $update_data->tested ) )       $obj->tested = $update_data->tested;
                if ( isset( $update_data->requires ) )      $obj->requires = $update_data->requires;
                if ( isset( $update_data->requires_php ) )  $obj->requires_php = $update_data->requires_php;

                $transient->response[ $file ] = $obj;
            }
        }
        return $transient;
    }

    public function plugin_popup_info( $result, $action, $args ) {
        if ( $action !== 'plugin_information' ) return $result;

        $slug = $args->slug;
        if ( ! str_starts_with( $slug, 'fp-' ) ) return $result;

        $plugins = get_plugins();
        $file = $slug . '/' . $slug . '.php';
        if ( ! isset( $plugins[ $file ] ) ) return $result;

        $settings = $this->get_settings();

        $url = add_query_arg([
                'slug'        => $slug,
                'license'     => $settings['license_key'] ?? '',
                'fingerprint' => $this->get_fingerprint(),
                'version'     => $plugins[ $file ]['Version']
        ], "{$this->api_base_url}/update-check");

        $response = wp_remote_get( $url, [ 'timeout' => 15 ] );
        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) return $result;

        $update_data = json_decode( wp_remote_retrieve_body( $response ) );

        $res = new stdClass();
        $res->name          = $plugins[ $file ]['Name'];
        $res->slug          = $slug;
        $res->version       = $update_data->version ?? 'Unknown';
        $res->tested        = $update_data->tested ?? '';
        $res->requires      = $update_data->requires ?? '';
        $res->requires_php  = $update_data->requires_php ?? '';
        $res->download_link = $update_data->download_url ?? '';
        $res->trunk         = $update_data->download_url ?? '';
        $res->sections      = [
                'description' => $plugins[ $file ]['Description'] ?? 'Managed via FINN Licensing.',
                'changelog'   => wp_kses_post( $update_data->sections->changelog ?? 'No changelog provided.' ),
        ];
        return $res;
    }

    public function handle_plugin_installation() {
        if (!current_user_can('install_plugins')) wp_die('Unauthorized');
        check_admin_referer('finn_install', 'nonce');

        $slug = sanitize_text_field($_GET['slug'] ?? '');
        if ( empty( $slug ) ) wp_die('Missing plugin slug.');

        $settings = $this->get_settings();

        $url = add_query_arg([
                'slug'        => $slug,
                'license'     => $settings['license_key'] ?? '',
                'fingerprint' => $this->get_fingerprint()
        ], "{$this->api_base_url}/update-check");

        $response = wp_remote_get( $url, [ 'timeout' => 15 ] );
        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            wp_die('Could not retrieve package from the FINN API. Verify your License Key.');
        }

        $data = json_decode( wp_remote_retrieve_body( $response ) );
        if ( empty($data->download_url) || empty($data->slug) ) wp_die('Invalid package data.');

        include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());

        $this->installing_slug = $data->slug;
        $upgrader->install($data->download_url);
        $this->installing_slug = '';

        wp_redirect(admin_url('admin.php?page=finn-dev&installed=true'));
        exit;
    }

    public function fix_folder_name( $source, $remote_source, $upgrader, $hook_extra = null ) {
        global $wp_filesystem;
        $plugin_slug = '';

        if ( isset( $hook_extra['plugin'] ) ) {
            $plugin_slug = dirname( $hook_extra['plugin'] );
        } elseif ( ! empty( $this->installing_slug ) ) {
            $plugin_slug = $this->installing_slug;
        }

        if ( empty( $plugin_slug ) ) return $source;

        $new_source = trailingslashit( $remote_source ) . $plugin_slug . '/';
        if ( basename( $source ) !== $plugin_slug && $wp_filesystem->move( $source, $new_source ) ) {
            return $new_source;
        }
        return $source;
    }

    public function register_settings() {
        register_setting( 'finn_updater_group', $this->option_name );
    }

    public function render_settings() {
        $settings = $this->get_settings();
        ?>
        <div class="wrap fd-wrap">
            <h1 class="fd-main-title">Settings</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'finn_updater_group' ); ?>

                <div class="fd-panel" style="max-width: 600px;">
                    <div class="fd-panel-header">
                        <h2><span class="dashicons dashicons-lock"></span> License Settings</h2>
                    </div>
                    <div class="fd-panel-content" style="padding: 25px;">

                        <table class="form-table">
                            <tr>
                                <th scope="row" style="padding-top:0;">
                                    <label for="api_key">Global API Key</label>
                                </th>
                                <td style="padding-top:0;">
                                    <input type="password" id="api_key" name="<?php echo $this->option_name; ?>[api_key]" value="<?php echo esc_attr($settings['api_key']); ?>" class="regular-text" />
                                    <p class="description" style="margin-top: 8px;">Used only to list available FINN plugins for one-click installation on the Dashboard.</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label for="license_key">Site License Key</label>
                                </th>
                                <td>
                                    <input type="password" id="license_key" name="<?php echo $this->option_name; ?>[license_key]" value="<?php echo esc_attr($settings['license_key']); ?>" class="regular-text" />
                                    <p class="description" style="margin-top: 8px;">Required to download updates and verify the domain fingerprint.</p>
                                </td>
                            </tr>
                        </table>

                        <div style="margin-top: 25px;">
                            <?php submit_button('Save Settings', 'primary', 'submit', false); ?>
                        </div>

                    </div>
                </div>
            </form>
        </div>
        <?php
    }
}

new FP_Dev_Dashboard();