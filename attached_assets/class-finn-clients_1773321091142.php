<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_Clients {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_submenu' ] );
    }

    public function register_submenu(): void {
        add_submenu_page(
            'finn-licensing',
            __( 'Clients', 'fp-licensing-server' ),
            __( 'Clients', 'fp-licensing-server' ),
            'manage_options',
            'finn-clients',
            [ $this, 'render_page' ]
        );
    }

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'fp-licensing-server' ) );
        }

        $action = isset( $_GET['action'] ) ? sanitize_key( $_GET['action'] ) : 'list';

        if ( 'save' === $action && isset( $_POST['finn_clients_nonce'] ) ) {
            $this->handle_save();
            return;
        }

        if ( 'delete' === $action && isset( $_GET['client_id'] ) ) {
            $this->handle_delete( absint( $_GET['client_id'] ) );
            return;
        }

        if ( 'edit' === $action && isset( $_GET['client_id'] ) ) {
            $this->render_form( absint( $_GET['client_id'] ) );
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
        $clients_table  = $wpdb->prefix . 'finn_clients';
        $licenses_table = $wpdb->prefix . 'finn_licenses';

        $clients = $wpdb->get_results(
            "SELECT c.*, COUNT(l.id) AS license_count
             FROM {$clients_table} c
             LEFT JOIN {$licenses_table} l ON l.client_id = c.id
             GROUP BY c.id
             ORDER BY c.name ASC" // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        );

        $add_url = admin_url( 'admin.php?page=finn-clients&action=add' );
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline"><?php esc_html_e( 'Clients', 'fp-licensing-server' ); ?></h1>
            <a href="<?php echo esc_url( $add_url ); ?>" class="page-title-action"><?php esc_html_e( 'Add Client', 'fp-licensing-server' ); ?></a>
            <hr class="wp-header-end">

            <?php $this->show_notices(); ?>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Name', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Company', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Email', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Licenses', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Created', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Actions', 'fp-licensing-server' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                <?php if ( empty( $clients ) ) : ?>
                    <tr>
                        <td colspan="6"><?php esc_html_e( 'No clients yet.', 'fp-licensing-server' ); ?></td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $clients as $client ) : ?>
                        <?php
                        $edit_url   = admin_url( 'admin.php?page=finn-clients&action=edit&client_id=' . absint( $client->id ) );
                        $delete_url = wp_nonce_url(
                            admin_url( 'admin.php?page=finn-clients&action=delete&client_id=' . absint( $client->id ) ),
                            'finn_delete_client_' . $client->id
                        );
                        ?>
                        <tr>
                            <td><strong><?php echo esc_html( $client->name ); ?></strong></td>
                            <td><?php echo $client->company ? esc_html( $client->company ) : '&mdash;'; ?></td>
                            <td><?php echo $client->email ? esc_html( $client->email ) : '&mdash;'; ?></td>
                            <td><?php echo absint( $client->license_count ); ?></td>
                            <td><?php echo esc_html( $client->created_at ); ?></td>
                            <td>
                                <a href="<?php echo esc_url( $edit_url ); ?>"><?php esc_html_e( 'Edit', 'fp-licensing-server' ); ?></a>
                                &nbsp;|&nbsp;
                                <a href="<?php echo esc_url( $delete_url ); ?>"
                                   onclick="return confirm('<?php esc_attr_e( 'Delete this client? Their licenses will NOT be deleted but will become orphaned (no client association). Continue?', 'fp-licensing-server' ); ?>')"
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

    private function render_form( int $client_id ): void {
        global $wpdb;
        $client  = null;
        $is_edit = $client_id > 0;
        $form_url = admin_url( 'admin.php?page=finn-clients&action=save' );

        if ( $is_edit ) {
            $table  = $wpdb->prefix . 'finn_clients';
            $client = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $client_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            if ( ! $client ) {
                wp_die( esc_html__( 'Client not found.', 'fp-licensing-server' ) );
            }
        }
        ?>
        <div class="wrap">
            <h1><?php echo $is_edit ? esc_html__( 'Edit Client', 'fp-licensing-server' ) : esc_html__( 'Add Client', 'fp-licensing-server' ); ?></h1>

            <?php $this->show_notices(); ?>

            <form method="post" action="<?php echo esc_url( $form_url ); ?>">
                <?php wp_nonce_field( 'finn_save_client', 'finn_clients_nonce' ); ?>
                <?php if ( $is_edit ) : ?>
                    <input type="hidden" name="client_id" value="<?php echo absint( $client_id ); ?>">
                <?php endif; ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="finn_name"><?php esc_html_e( 'Name', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="finn_name" name="finn_name" class="regular-text"
                                   value="<?php echo $is_edit ? esc_attr( $client->name ) : ''; ?>" required>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_company"><?php esc_html_e( 'Company', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="text" id="finn_company" name="finn_company" class="regular-text"
                                   value="<?php echo $is_edit ? esc_attr( $client->company ) : ''; ?>">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_email"><?php esc_html_e( 'Email', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="email" id="finn_email" name="finn_email" class="regular-text"
                                   value="<?php echo $is_edit ? esc_attr( $client->email ) : ''; ?>">
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_notes"><?php esc_html_e( 'Notes', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <textarea id="finn_notes" name="finn_notes" class="large-text" rows="4"><?php echo $is_edit ? esc_textarea( $client->notes ) : ''; ?></textarea>
                        </td>
                    </tr>
                </table>

                <?php submit_button( $is_edit ? __( 'Update Client', 'fp-licensing-server' ) : __( 'Add Client', 'fp-licensing-server' ) ); ?>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=finn-clients' ) ); ?>" class="button">
                    <?php esc_html_e( 'Cancel', 'fp-licensing-server' ); ?>
                </a>
            </form>
        </div>
        <?php
    }

    private function handle_save(): void {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['finn_clients_nonce'] ?? '' ) ), 'finn_save_client' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;
        $table     = $wpdb->prefix . 'finn_clients';
        $client_id = absint( $_POST['client_id'] ?? 0 );
        $name      = sanitize_text_field( wp_unslash( $_POST['finn_name'] ?? '' ) );
        $company   = sanitize_text_field( wp_unslash( $_POST['finn_company'] ?? '' ) );
        $email     = sanitize_email( wp_unslash( $_POST['finn_email'] ?? '' ) );
        $notes     = sanitize_textarea_field( wp_unslash( $_POST['finn_notes'] ?? '' ) );

        if ( empty( $name ) ) {
            $this->redirect_with_notice( 'error', __( 'Name is required.', 'fp-licensing-server' ), $client_id );
            return;
        }

        $data    = [
            'name'    => $name,
            'company' => $company ?: null,
            'email'   => $email ?: null,
            'notes'   => $notes ?: null,
        ];
        $formats = [ '%s', '%s', '%s', '%s' ];

        if ( $client_id > 0 ) {
            $result = $wpdb->update( $table, $data, [ 'id' => $client_id ], $formats, [ '%d' ] );
            if ( false === $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to update client.', 'fp-licensing-server' ), $client_id );
                return;
            }
            $this->redirect_with_notice( 'updated', __( 'Client updated.', 'fp-licensing-server' ) );
        } else {
            $result = $wpdb->insert( $table, $data, $formats );
            if ( ! $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to add client.', 'fp-licensing-server' ), 0, 'add' );
                return;
            }
            $this->redirect_with_notice( 'updated', __( 'Client added.', 'fp-licensing-server' ) );
        }
    }

    private function handle_delete( int $client_id ): void {
        if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ), 'finn_delete_client_' . $client_id ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;

        // Orphan licenses — set client_id to NULL rather than deleting them.
        $licenses_table = $wpdb->prefix . 'finn_licenses';
        $wpdb->update(
            $licenses_table,
            [ 'client_id' => null ],
            [ 'client_id' => $client_id ],
            [ null ],
            [ '%d' ]
        );

        $clients_table = $wpdb->prefix . 'finn_clients';
        $wpdb->delete( $clients_table, [ 'id' => $client_id ], [ '%d' ] );

        $this->redirect_with_notice( 'updated', __( 'Client deleted. Their licenses have been orphaned (no client association).', 'fp-licensing-server' ) );
    }

    private function redirect_with_notice( string $type, string $message, int $client_id = 0, string $action = 'list' ): void {
        $base = admin_url( 'admin.php?page=finn-clients' );

        if ( $client_id > 0 ) {
            $url = add_query_arg( [ 'action' => 'edit', 'client_id' => $client_id, 'notice' => $type, 'notice_msg' => rawurlencode( $message ) ], $base );
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
