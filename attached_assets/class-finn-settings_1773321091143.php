<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_Settings {

    const OPTION_GITHUB_TOKEN = 'finn_ls_github_token';
    const OPTION_API_KEY      = 'finn_ls_api_key';

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_submenu' ] );
    }

    public function register_submenu(): void {
        add_submenu_page(
            'finn-licensing',
            __( 'Settings', 'fp-licensing-server' ),
            __( 'Settings', 'fp-licensing-server' ),
            'manage_options',
            'finn-settings',
            [ $this, 'render_page' ]
        );
    }

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'fp-licensing-server' ) );
        }

        if ( isset( $_POST['finn_settings_nonce'] ) ) {
            $this->handle_save();
            return;
        }

        if ( isset( $_POST['finn_regenerate_nonce'] ) ) {
            $this->handle_regenerate();
            return;
        }

        // Auto-generate API key on first load.
        $raw_api_key = self::get_api_key();
        if ( empty( $raw_api_key ) ) {
            $raw_api_key = wp_generate_uuid4();
            update_option( self::OPTION_API_KEY, self::encrypt_token( $raw_api_key ), false );
        }

        $has_token = ! empty( get_option( self::OPTION_GITHUB_TOKEN ) );
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'FINN Licensing Settings', 'fp-licensing-server' ); ?></h1>

            <?php $this->show_notices(); ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <?php esc_html_e( 'Global API Key', 'fp-licensing-server' ); ?>
                    </th>
                    <td>
                        <input type="text" id="finn_api_key_display" class="regular-text" value="<?php echo esc_attr( $raw_api_key ); ?>" readonly>
                        <form method="post" action="" style="display:inline-block;margin-left:8px;">
                            <?php wp_nonce_field( 'finn_regenerate_api_key', 'finn_regenerate_nonce' ); ?>
                            <?php submit_button( __( 'Regenerate', 'fp-licensing-server' ), 'secondary', 'finn_regenerate_submit', false ); ?>
                        </form>
                        <p class="description">
                            <?php esc_html_e( 'Used by the FINN DEV Dashboard to authenticate requests to the /products endpoint. Stored encrypted.', 'fp-licensing-server' ); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <form method="post" action="">
                <?php wp_nonce_field( 'finn_save_settings', 'finn_settings_nonce' ); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="finn_github_token"><?php esc_html_e( 'GitHub Personal Access Token', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="password" id="finn_github_token" name="finn_github_token" class="regular-text"
                                   placeholder="<?php echo $has_token ? esc_attr__( '(token saved — enter new value to change)', 'fp-licensing-server' ) : 'ghp_...'; ?>"
                                   autocomplete="new-password">
                            <p class="description">
                                <?php esc_html_e( 'Used to authenticate GitHub API requests when polling for new releases. Stored encrypted.', 'fp-licensing-server' ); ?>
                                <?php if ( $has_token ) : ?>
                                    <br><strong><?php esc_html_e( 'A token is currently saved.', 'fp-licensing-server' ); ?></strong>
                                <?php endif; ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <?php submit_button( __( 'Save Settings', 'fp-licensing-server' ) ); ?>
            </form>
        </div>
        <?php
    }

    private function handle_save(): void {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['finn_settings_nonce'] ?? '' ) ), 'finn_save_settings' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        $github_token = sanitize_text_field( wp_unslash( $_POST['finn_github_token'] ?? '' ) );
        if ( ! empty( $github_token ) ) {
            update_option( self::OPTION_GITHUB_TOKEN, self::encrypt_token( $github_token ), false );
        }

        wp_safe_redirect(
            add_query_arg(
                [
                    'page'       => 'finn-settings',
                    'notice'     => 'updated',
                    'notice_msg' => rawurlencode( __( 'Settings saved.', 'fp-licensing-server' ) ),
                ],
                admin_url( 'admin.php' )
            )
        );
        exit;
    }

    private function handle_regenerate(): void {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['finn_regenerate_nonce'] ?? '' ) ), 'finn_regenerate_api_key' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        $new_key = wp_generate_uuid4();
        update_option( self::OPTION_API_KEY, self::encrypt_token( $new_key ), false );

        wp_safe_redirect(
            add_query_arg(
                [
                    'page'       => 'finn-settings',
                    'notice'     => 'updated',
                    'notice_msg' => rawurlencode( __( 'API key regenerated.', 'fp-licensing-server' ) ),
                ],
                admin_url( 'admin.php' )
            )
        );
        exit;
    }

    public static function get_api_key(): string {
        $encrypted = get_option( self::OPTION_API_KEY, '' );
        if ( empty( $encrypted ) ) {
            return '';
        }
        return self::decrypt_token( $encrypted );
    }

    public static function get_github_token(): string {
        $encrypted = get_option( self::OPTION_GITHUB_TOKEN, '' );
        if ( empty( $encrypted ) ) {
            return '';
        }
        return self::decrypt_token( $encrypted );
    }

    public static function encrypt_token( string $token ): string {
        $key    = substr( hash( 'sha256', defined( 'AUTH_KEY' ) ? AUTH_KEY : wp_salt() ), 0, 32 );
        $iv     = openssl_random_pseudo_bytes( 16 );
        $cipher = openssl_encrypt( $token, 'AES-256-CBC', $key, 0, $iv );
        return base64_encode( $iv . $cipher );
    }

    public static function decrypt_token( string $encrypted ): string {
        $key  = substr( hash( 'sha256', defined( 'AUTH_KEY' ) ? AUTH_KEY : wp_salt() ), 0, 32 );
        $data = base64_decode( $encrypted );
        if ( strlen( $data ) < 17 ) {
            return '';
        }
        $iv     = substr( $data, 0, 16 );
        $cipher = substr( $data, 16 );
        $result = openssl_decrypt( $cipher, 'AES-256-CBC', $key, 0, $iv );
        return false !== $result ? $result : '';
    }

    private function show_notices(): void {
        if ( ! isset( $_GET['notice'] ) || ! isset( $_GET['notice_msg'] ) ) {
            return;
        }
        $type    = sanitize_key( $_GET['notice'] );
        $message = sanitize_text_field( rawurldecode( $_GET['notice_msg'] ) );

        if ( 'updated' === $type ) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
        } else {
            echo '<div class="notice notice-error is-dismissible"><p>' . esc_html( $message ) . '</p></div>';
        }
    }
}
