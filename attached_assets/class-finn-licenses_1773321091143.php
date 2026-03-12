<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_Licenses {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_submenu' ] );
    }

    public function register_submenu(): void {
        add_submenu_page(
            'finn-licensing',
            __( 'Licenses', 'fp-licensing-server' ),
            __( 'Licenses', 'fp-licensing-server' ),
            'manage_options',
            'finn-licenses',
            [ $this, 'render_page' ]
        );
    }

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'fp-licensing-server' ) );
        }

        $action = isset( $_GET['action'] ) ? sanitize_key( $_GET['action'] ) : 'list';

        if ( 'save' === $action && isset( $_POST['finn_licenses_nonce'] ) ) {
            $this->handle_save();
            return;
        }

        if ( 'delete' === $action && isset( $_GET['license_id'] ) ) {
            $this->handle_delete( absint( $_GET['license_id'] ) );
            return;
        }

        if ( 'toggle' === $action && isset( $_GET['license_id'] ) ) {
            $this->handle_toggle( absint( $_GET['license_id'] ) );
            return;
        }

        if ( 'edit' === $action && isset( $_GET['license_id'] ) ) {
            $this->render_form( absint( $_GET['license_id'] ) );
            return;
        }

        if ( 'add' === $action ) {
            $this->render_form( 0 );
            return;
        }

        $this->render_list();
    }

    private function render_list(): void {
        global $wpdb;
        $licenses_table = $wpdb->prefix . 'finn_licenses';
        $clients_table  = $wpdb->prefix . 'finn_clients';

        $licenses = $wpdb->get_results(
            "SELECT l.*, c.name AS client_name
             FROM {$licenses_table} l
             LEFT JOIN {$clients_table} c ON c.id = l.client_id
             ORDER BY l.created_at DESC" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        );

        $add_url = admin_url( 'admin.php?page=finn-licenses&action=add' );
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline"><?php esc_html_e( 'Licenses', 'fp-licensing-server' ); ?></h1>
            <a href="<?php echo esc_url( $add_url ); ?>" class="page-title-action"><?php esc_html_e( 'Add License', 'fp-licensing-server' ); ?></a>
            <hr class="wp-header-end">

            <?php $this->show_notices(); ?>
            <?php $this->show_new_key_notice(); ?>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'License Key', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Client', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Domain', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Plugin Access', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Status', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Created', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Actions', 'fp-licensing-server' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                <?php if ( empty( $licenses ) ) : ?>
                    <tr>
                        <td colspan="7"><?php esc_html_e( 'No licenses yet.', 'fp-licensing-server' ); ?></td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $licenses as $license ) : ?>
                        <?php
                        $truncated   = substr( $license->license_key, 0, 8 ) . '…';
                        $edit_url    = admin_url( 'admin.php?page=finn-licenses&action=edit&license_id=' . absint( $license->id ) );
                        $delete_url  = wp_nonce_url(
                            admin_url( 'admin.php?page=finn-licenses&action=delete&license_id=' . absint( $license->id ) ),
                            'finn_delete_license_' . $license->id
                        );
                        $toggle_url  = wp_nonce_url(
                            admin_url( 'admin.php?page=finn-licenses&action=toggle&license_id=' . absint( $license->id ) ),
                            'finn_toggle_license_' . $license->id
                        );
                        $is_active   = 'active' === $license->status;

                        if ( 'all' === $license->plugin_access ) {
                            $access_label = __( 'All Plugins', 'fp-licensing-server' );
                        } else {
                            $access_label = __( 'Select Plugins', 'fp-licensing-server' );
                        }
                        ?>
                        <tr>
                            <td><code><?php echo esc_html( $truncated ); ?></code></td>
                            <td><?php echo $license->client_name ? esc_html( $license->client_name ) : '<em>' . esc_html__( 'Orphaned', 'fp-licensing-server' ) . '</em>'; ?></td>
                            <td><?php echo esc_html( $license->domain ); ?></td>
                            <td><?php echo esc_html( $access_label ); ?></td>
                            <td>
                                <span style="color:<?php echo $is_active ? '#1a7a1a' : '#b32d2e'; ?>; font-weight:bold;">
                                    <?php echo $is_active ? esc_html__( 'Active', 'fp-licensing-server' ) : esc_html__( 'Revoked', 'fp-licensing-server' ); ?>
                                </span>
                            </td>
                            <td><?php echo esc_html( $license->created_at ); ?></td>
                            <td>
                                <a href="<?php echo esc_url( $toggle_url ); ?>">
                                    <?php echo $is_active ? esc_html__( 'Revoke', 'fp-licensing-server' ) : esc_html__( 'Activate', 'fp-licensing-server' ); ?>
                                </a>
                                &nbsp;|&nbsp;
                                <a href="<?php echo esc_url( $edit_url ); ?>"><?php esc_html_e( 'Edit', 'fp-licensing-server' ); ?></a>
                                &nbsp;|&nbsp;
                                <a href="<?php echo esc_url( $delete_url ); ?>"
                                   onclick="return confirm('<?php esc_attr_e( 'Delete this license? This cannot be undone.', 'fp-licensing-server' ); ?>')"
                                   style="color:#b32d2e;"><?php esc_html_e( 'Delete', 'fp-licensing-server' ); ?></a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    private function show_new_key_notice(): void {
        if ( empty( $_GET['new_key'] ) ) {
            return;
        }
        $key = sanitize_text_field( rawurldecode( $_GET['new_key'] ) );
        // Basic UUID format check before displaying.
        if ( ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $key ) ) {
            return;
        }
        ?>
        <div class="notice notice-warning" style="padding:12px 16px;">
            <p><strong><?php esc_html_e( 'License created! Copy the full key now — it will not be shown again.', 'fp-licensing-server' ); ?></strong></p>
            <p>
                <input type="text" id="finn_new_license_key" value="<?php echo esc_attr( $key ); ?>"
                       readonly style="width:340px;font-family:monospace;" onclick="this.select();">
                &nbsp;
                <button type="button" class="button"
                        onclick="navigator.clipboard.writeText(document.getElementById('finn_new_license_key').value).then(function(){alert('<?php esc_attr_e( 'Copied!', 'fp-licensing-server' ); ?>')});">
                    <?php esc_html_e( 'Copy', 'fp-licensing-server' ); ?>
                </button>
            </p>
        </div>
        <?php
    }

    private function render_form( int $license_id ): void {
        global $wpdb;
        $license  = null;
        $is_edit  = $license_id > 0;
        $form_url = admin_url( 'admin.php?page=finn-licenses&action=save' );

        if ( $is_edit ) {
            $table   = $wpdb->prefix . 'finn_licenses';
            $license = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $license_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            if ( ! $license ) {
                wp_die( esc_html__( 'License not found.', 'fp-licensing-server' ) );
            }
        }

        // Clients dropdown.
        $clients = $wpdb->get_results( "SELECT id, name FROM {$wpdb->prefix}finn_clients ORDER BY name ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

        // Products for multi-select.
        $products = $wpdb->get_results( "SELECT id, name FROM {$wpdb->prefix}finn_products ORDER BY name ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

        $selected_products = [];
        if ( $is_edit && $license->product_ids ) {
            $selected_products = array_map( 'intval', explode( ',', $license->product_ids ) );
        }
        ?>
        <div class="wrap">
            <h1><?php echo $is_edit ? esc_html__( 'Edit License', 'fp-licensing-server' ) : esc_html__( 'Add License', 'fp-licensing-server' ); ?></h1>

            <?php $this->show_notices(); ?>

            <form method="post" action="<?php echo esc_url( $form_url ); ?>">
                <?php wp_nonce_field( 'finn_save_license', 'finn_licenses_nonce' ); ?>
                <?php if ( $is_edit ) : ?>
                    <input type="hidden" name="license_id" value="<?php echo absint( $license_id ); ?>">
                <?php endif; ?>

                <table class="form-table" role="presentation">
                    <?php if ( $is_edit ) : ?>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'License Key', 'fp-licensing-server' ); ?></th>
                        <td>
                            <code><?php echo esc_html( substr( $license->license_key, 0, 8 ) . '………' ); ?></code>
                            <p class="description"><?php esc_html_e( 'The full key is not shown after creation.', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <?php endif; ?>
                    <tr>
                        <th scope="row">
                            <label for="finn_client_id"><?php esc_html_e( 'Client', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <select id="finn_client_id" name="finn_client_id" required>
                                <option value=""><?php esc_html_e( '— Select a client —', 'fp-licensing-server' ); ?></option>
                                <?php foreach ( $clients as $client ) : ?>
                                    <option value="<?php echo absint( $client->id ); ?>"
                                        <?php selected( $is_edit ? absint( $license->client_id ) : 0, absint( $client->id ) ); ?>>
                                        <?php echo esc_html( $client->name ); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_domain"><?php esc_html_e( 'Domain', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="finn_domain" name="finn_domain" class="regular-text"
                                   placeholder="example.com"
                                   value="<?php echo $is_edit ? esc_attr( $license->domain ) : ''; ?>" required>
                            <p class="description"><?php esc_html_e( 'Enter the bare domain (e.g. example.com). www. will be stripped automatically.', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Plugin Access', 'fp-licensing-server' ); ?></th>
                        <td>
                            <label>
                                <input type="radio" name="finn_plugin_access" value="all"
                                    <?php checked( $is_edit ? $license->plugin_access : 'all', 'all' ); ?>>
                                <?php esc_html_e( 'All Plugins', 'fp-licensing-server' ); ?>
                            </label>
                            <br><br>
                            <label>
                                <input type="radio" name="finn_plugin_access" value="specific"
                                    <?php checked( $is_edit ? $license->plugin_access : 'all', 'specific' ); ?>>
                                <?php esc_html_e( 'Select Plugins', 'fp-licensing-server' ); ?>
                            </label>
                            <?php if ( ! empty( $products ) ) : ?>
                                <div id="finn_products_wrap" style="margin-top:8px; padding-left:20px; <?php echo ( $is_edit && 'specific' === $license->plugin_access ) ? '' : 'display:none;'; ?>">
                                    <select name="finn_product_ids[]" id="finn_product_ids" multiple size="6" style="min-width:240px;">
                                        <?php foreach ( $products as $product ) : ?>
                                            <option value="<?php echo absint( $product->id ); ?>"
                                                <?php echo in_array( absint( $product->id ), $selected_products, true ) ? 'selected' : ''; ?>>
                                                <?php echo esc_html( $product->name ); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <p class="description"><?php esc_html_e( 'Hold Ctrl/Cmd to select multiple products.', 'fp-licensing-server' ); ?></p>
                                </div>
                            <?php else : ?>
                                <p class="description" style="padding-left:20px;"><?php esc_html_e( 'No products registered yet.', 'fp-licensing-server' ); ?></p>
                            <?php endif; ?>
                            <script>
                            (function(){
                                var radios = document.querySelectorAll('input[name="finn_plugin_access"]');
                                var wrap   = document.getElementById('finn_products_wrap');
                                radios.forEach(function(r){
                                    r.addEventListener('change', function(){
                                        if(wrap) wrap.style.display = (r.value === 'specific' && r.checked) ? '' : 'none';
                                    });
                                });
                            })();
                            </script>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e( 'Status', 'fp-licensing-server' ); ?></th>
                        <td>
                            <label>
                                <input type="radio" name="finn_status" value="active"
                                    <?php checked( $is_edit ? $license->status : 'active', 'active' ); ?>>
                                <?php esc_html_e( 'Active', 'fp-licensing-server' ); ?>
                            </label>
                            &nbsp;&nbsp;
                            <label>
                                <input type="radio" name="finn_status" value="revoked"
                                    <?php checked( $is_edit ? $license->status : 'active', 'revoked' ); ?>>
                                <?php esc_html_e( 'Revoked', 'fp-licensing-server' ); ?>
                            </label>
                        </td>
                    </tr>
                </table>

                <?php submit_button( $is_edit ? __( 'Update License', 'fp-licensing-server' ) : __( 'Add License', 'fp-licensing-server' ) ); ?>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=finn-licenses' ) ); ?>" class="button">
                    <?php esc_html_e( 'Cancel', 'fp-licensing-server' ); ?>
                </a>
            </form>
        </div>
        <?php
    }

    private function handle_save(): void {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['finn_licenses_nonce'] ?? '' ) ), 'finn_save_license' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;
        $table      = $wpdb->prefix . 'finn_licenses';
        $license_id = absint( $_POST['license_id'] ?? 0 );
        $client_id  = absint( $_POST['finn_client_id'] ?? 0 );
        $domain_raw = sanitize_text_field( wp_unslash( $_POST['finn_domain'] ?? '' ) );
        $access     = sanitize_key( $_POST['finn_plugin_access'] ?? 'all' );
        $status     = sanitize_key( $_POST['finn_status'] ?? 'active' );

        // Validate required fields.
        if ( ! $client_id ) {
            $this->redirect_with_notice( 'error', __( 'Client is required.', 'fp-licensing-server' ), $license_id ?: 0, $license_id ? 'edit' : 'add' );
            return;
        }

        if ( empty( $domain_raw ) ) {
            $this->redirect_with_notice( 'error', __( 'Domain is required.', 'fp-licensing-server' ), $license_id ?: 0, $license_id ? 'edit' : 'add' );
            return;
        }

        // Normalise domain — strip www. and scheme.
        $domain = $this->normalise_domain( $domain_raw );

        // Validate plugin access value.
        if ( ! in_array( $access, [ 'all', 'specific' ], true ) ) {
            $access = 'all';
        }

        // Validate status.
        if ( ! in_array( $status, [ 'active', 'revoked' ], true ) ) {
            $status = 'active';
        }

        // Product IDs (only relevant when access = specific).
        $product_ids = null;
        if ( 'specific' === $access ) {
            $raw_ids = isset( $_POST['finn_product_ids'] ) && is_array( $_POST['finn_product_ids'] )
                ? array_map( 'absint', $_POST['finn_product_ids'] )
                : [];
            $raw_ids = array_filter( $raw_ids );
            $product_ids = ! empty( $raw_ids ) ? implode( ',', $raw_ids ) : null;
        }

        $data = [
            'client_id'     => $client_id,
            'domain'        => $domain,
            'plugin_access' => $access,
            'product_ids'   => $product_ids,
            'status'        => $status,
        ];
        $formats = [ '%d', '%s', '%s', '%s', '%s' ];

        if ( $license_id > 0 ) {
            $result = $wpdb->update( $table, $data, [ 'id' => $license_id ], $formats, [ '%d' ] );
            if ( false === $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to update license.', 'fp-licensing-server' ), $license_id, 'edit' );
                return;
            }
            $this->redirect_with_notice( 'updated', __( 'License updated.', 'fp-licensing-server' ) );
        } else {
            // Auto-generate UUID for new license.
            $data['license_key'] = wp_generate_uuid4();
            $formats[]           = '%s';

            $result = $wpdb->insert( $table, $data, $formats );
            if ( ! $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to create license.', 'fp-licensing-server' ), 0, 'add' );
                return;
            }

            // Redirect to list showing the full key once.
            $base = admin_url( 'admin.php?page=finn-licenses' );
            $url  = add_query_arg( [
                'notice'     => 'updated',
                'notice_msg' => rawurlencode( __( 'License created.', 'fp-licensing-server' ) ),
                'new_key'    => rawurlencode( $data['license_key'] ),
            ], $base );
            wp_safe_redirect( $url );
            exit;
        }
    }

    private function handle_delete( int $license_id ): void {
        if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ), 'finn_delete_license_' . $license_id ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;
        $wpdb->delete( $wpdb->prefix . 'finn_licenses', [ 'id' => $license_id ], [ '%d' ] );
        $this->redirect_with_notice( 'updated', __( 'License deleted.', 'fp-licensing-server' ) );
    }

    private function handle_toggle( int $license_id ): void {
        if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ), 'finn_toggle_license_' . $license_id ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;
        $table   = $wpdb->prefix . 'finn_licenses';
        $license = $wpdb->get_row( $wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $license_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

        if ( ! $license ) {
            $this->redirect_with_notice( 'error', __( 'License not found.', 'fp-licensing-server' ) );
            return;
        }

        $new_status = ( 'active' === $license->status ) ? 'revoked' : 'active';
        $wpdb->update( $table, [ 'status' => $new_status ], [ 'id' => $license_id ], [ '%s' ], [ '%d' ] );

        $msg = ( 'active' === $new_status )
            ? __( 'License activated.', 'fp-licensing-server' )
            : __( 'License revoked.', 'fp-licensing-server' );

        $this->redirect_with_notice( 'updated', $msg );
    }

    /**
     * Normalise domain fingerprint: strip scheme, www., trailing slashes, and lowercase.
     */
    private function normalise_domain( string $domain ): string {
        // Strip scheme.
        $domain = preg_replace( '#^https?://#i', '', trim( $domain ) );
        // Strip path/query.
        $domain = strtok( $domain, '/' );
        // Strip www.
        $domain = preg_replace( '/^www\./i', '', $domain );
        return strtolower( rtrim( $domain, '.' ) );
    }

    private function redirect_with_notice( string $type, string $message, int $license_id = 0, string $action = 'list' ): void {
        $base = admin_url( 'admin.php?page=finn-licenses' );

        if ( $license_id > 0 && 'edit' === $action ) {
            $url = add_query_arg( [ 'action' => 'edit', 'license_id' => $license_id, 'notice' => $type, 'notice_msg' => rawurlencode( $message ) ], $base );
        } elseif ( 'add' === $action ) {
            $url = add_query_arg( [ 'action' => 'add', 'notice' => $type, 'notice_msg' => rawurlencode( $message ) ], $base );
        } else {
            $url = add_query_arg( [ 'notice' => $type, 'notice_msg' => rawurlencode( $message ) ], $base );
        }

        wp_safe_redirect( $url );
        exit;
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
