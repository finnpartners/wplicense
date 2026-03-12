<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_Plugins {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_submenu' ] );
    }

    public function register_submenu(): void {
        add_submenu_page(
            'finn-licensing',
            __( 'Plugins', 'fp-licensing-server' ),
            __( 'Plugins', 'fp-licensing-server' ),
            'manage_options',
            'finn-plugins',
            [ $this, 'render_page' ]
        );
    }

    public function render_page(): void {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to access this page.', 'fp-licensing-server' ) );
        }

        $action = isset( $_GET['action'] ) ? sanitize_key( $_GET['action'] ) : 'list';

        // Handle form submissions.
        if ( 'save' === $action && isset( $_POST['finn_plugins_nonce'] ) ) {
            $this->handle_save();
            return;
        }

        if ( 'delete' === $action && isset( $_GET['plugin_id'] ) ) {
            $this->handle_delete( absint( $_GET['plugin_id'] ) );
            return;
        }

        if ( 'poll' === $action && isset( $_GET['plugin_id'] ) ) {
            $this->handle_poll( absint( $_GET['plugin_id'] ) );
            return;
        }

        if ( 'edit' === $action && isset( $_GET['plugin_id'] ) ) {
            $this->render_form( absint( $_GET['plugin_id'] ) );
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
        $table   = $wpdb->prefix . 'finn_products';
        $plugins = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY name ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $add_url  = admin_url( 'admin.php?page=finn-plugins&action=add' );
        ?>
        <div class="wrap">
            <h1 class="wp-heading-inline"><?php esc_html_e( 'Plugins', 'fp-licensing-server' ); ?></h1>
            <a href="<?php echo esc_url( $add_url ); ?>" class="page-title-action"><?php esc_html_e( 'Add Plugin', 'fp-licensing-server' ); ?></a>
            <hr class="wp-header-end">

            <?php $this->show_notices(); ?>

            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Name', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Slug', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'GitHub Repo', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Latest Version', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Last Checked', 'fp-licensing-server' ); ?></th>
                        <th><?php esc_html_e( 'Actions', 'fp-licensing-server' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                <?php if ( empty( $plugins ) ) : ?>
                    <tr>
                        <td colspan="6"><?php esc_html_e( 'No plugins registered yet.', 'fp-licensing-server' ); ?></td>
                    </tr>
                <?php else : ?>
                    <?php foreach ( $plugins as $plugin ) : ?>
                        <?php
                        $edit_url   = admin_url( 'admin.php?page=finn-plugins&action=edit&plugin_id=' . absint( $plugin->id ) );
                        $delete_url = wp_nonce_url(
                            admin_url( 'admin.php?page=finn-plugins&action=delete&plugin_id=' . absint( $plugin->id ) ),
                            'finn_delete_plugin_' . $plugin->id
                        );
                        $poll_url = wp_nonce_url(
                            admin_url( 'admin.php?page=finn-plugins&action=poll&plugin_id=' . absint( $plugin->id ) ),
                            'finn_poll_plugin_' . $plugin->id
                        );
                        ?>
                        <tr>
                            <td><strong><?php echo esc_html( $plugin->name ); ?></strong></td>
                            <td><?php echo esc_html( $plugin->slug ); ?></td>
                            <td><?php echo esc_html( $plugin->github_repo ); ?></td>
                            <td><?php echo $plugin->latest_version ? esc_html( $plugin->latest_version ) : '&mdash;'; ?></td>
                            <td><?php echo $plugin->last_checked ? esc_html( $plugin->last_checked ) : '&mdash;'; ?></td>
                            <td>
                                <a href="<?php echo esc_url( $edit_url ); ?>"><?php esc_html_e( 'Edit', 'fp-licensing-server' ); ?></a>
                                &nbsp;|&nbsp;
                                <a href="<?php echo esc_url( $poll_url ); ?>"><?php esc_html_e( 'Check Now', 'fp-licensing-server' ); ?></a>
                                &nbsp;|&nbsp;
                                <a href="<?php echo esc_url( $delete_url ); ?>"
                                   onclick="return confirm('<?php esc_attr_e( 'Delete this plugin? License assignments referencing it will become unrestricted.', 'fp-licensing-server' ); ?>')"
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

    private function render_form( int $plugin_id ): void {
        global $wpdb;
        $plugin   = null;
        $is_edit  = $plugin_id > 0;
        $form_url = admin_url( 'admin.php?page=finn-plugins&action=save' );

        if ( $is_edit ) {
            $table  = $wpdb->prefix . 'finn_products';
            $plugin = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $plugin_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            if ( ! $plugin ) {
                wp_die( esc_html__( 'Plugin not found.', 'fp-licensing-server' ) );
            }
        }
        ?>
        <div class="wrap">
            <h1><?php echo $is_edit ? esc_html__( 'Edit Plugin', 'fp-licensing-server' ) : esc_html__( 'Add Plugin', 'fp-licensing-server' ); ?></h1>

            <?php $this->show_notices(); ?>

            <form method="post" action="<?php echo esc_url( $form_url ); ?>">
                <?php wp_nonce_field( 'finn_save_plugin', 'finn_plugins_nonce' ); ?>
                <?php if ( $is_edit ) : ?>
                    <input type="hidden" name="plugin_id" value="<?php echo absint( $plugin_id ); ?>">
                <?php endif; ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="finn_name"><?php esc_html_e( 'Plugin Name', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="finn_name" name="finn_name" class="regular-text"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->name ) : ''; ?>" required>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_slug"><?php esc_html_e( 'Plugin Slug', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="finn_slug" name="finn_slug" class="regular-text"
                                   placeholder="fp-seo-manager"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->slug ) : ''; ?>" required>
                            <p class="description"><?php esc_html_e( 'Lowercase letters, numbers, and hyphens only. e.g. fp-seo-manager', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_github_repo"><?php esc_html_e( 'GitHub Repo', 'fp-licensing-server' ); ?> <span style="color:red;">*</span></label>
                        </th>
                        <td>
                            <input type="text" id="finn_github_repo" name="finn_github_repo" class="regular-text"
                                   placeholder="finnpartners/fp-seo-manager"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->github_repo ) : ''; ?>" required>
                            <p class="description"><?php esc_html_e( 'Format: owner/repo — e.g. finnpartners/fp-seo-manager', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_description"><?php esc_html_e( 'Description', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <textarea id="finn_description" name="finn_description" class="large-text" rows="4"><?php echo $is_edit ? esc_textarea( $plugin->description ) : ''; ?></textarea>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_requires_wp"><?php esc_html_e( 'Requires WordPress', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="text" id="finn_requires_wp" name="finn_requires_wp" class="small-text"
                                   placeholder="6.0"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->requires_wp ?? '' ) : ''; ?>">
                            <p class="description"><?php esc_html_e( 'Minimum WordPress version required.', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_tested_wp"><?php esc_html_e( 'Tested Up To', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="text" id="finn_tested_wp" name="finn_tested_wp" class="small-text"
                                   placeholder="6.7"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->tested_wp ?? '' ) : ''; ?>">
                            <p class="description"><?php esc_html_e( 'WordPress version tested up to.', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">
                            <label for="finn_requires_php"><?php esc_html_e( 'Requires PHP', 'fp-licensing-server' ); ?></label>
                        </th>
                        <td>
                            <input type="text" id="finn_requires_php" name="finn_requires_php" class="small-text"
                                   placeholder="8.0"
                                   value="<?php echo $is_edit ? esc_attr( $plugin->requires_php ?? '' ) : ''; ?>">
                            <p class="description"><?php esc_html_e( 'Minimum PHP version required.', 'fp-licensing-server' ); ?></p>
                        </td>
                    </tr>
                </table>

                <?php submit_button( $is_edit ? __( 'Update Plugin', 'fp-licensing-server' ) : __( 'Add Plugin', 'fp-licensing-server' ) ); ?>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=finn-plugins' ) ); ?>" class="button">
                    <?php esc_html_e( 'Cancel', 'fp-licensing-server' ); ?>
                </a>
            </form>
        </div>
        <?php
    }

    private function handle_save(): void {
        if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['finn_plugins_nonce'] ?? '' ) ), 'finn_save_plugin' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;
        $table        = $wpdb->prefix . 'finn_products';
        $plugin_id    = absint( $_POST['plugin_id'] ?? 0 );
        $name         = sanitize_text_field( wp_unslash( $_POST['finn_name'] ?? '' ) );
        $slug         = sanitize_title( wp_unslash( $_POST['finn_slug'] ?? '' ) );
        $github       = sanitize_text_field( wp_unslash( $_POST['finn_github_repo'] ?? '' ) );
        $desc         = sanitize_textarea_field( wp_unslash( $_POST['finn_description'] ?? '' ) );
        $requires_wp  = sanitize_text_field( wp_unslash( $_POST['finn_requires_wp'] ?? '' ) );
        $tested_wp    = sanitize_text_field( wp_unslash( $_POST['finn_tested_wp'] ?? '' ) );
        $requires_php = sanitize_text_field( wp_unslash( $_POST['finn_requires_php'] ?? '' ) );

        if ( empty( $name ) || empty( $slug ) || empty( $github ) ) {
            $this->redirect_with_notice( 'error', __( 'Name, Slug, and GitHub Repo are required.', 'fp-licensing-server' ), $plugin_id );
            return;
        }

        // Validate github_repo format: owner/repo.
        if ( ! preg_match( '/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/', $github ) ) {
            $this->redirect_with_notice( 'error', __( 'GitHub Repo must be in owner/repo format.', 'fp-licensing-server' ), $plugin_id );
            return;
        }

        $data = [
            'name'         => $name,
            'slug'         => $slug,
            'github_repo'  => $github,
            'description'  => $desc,
            'requires_wp'  => $requires_wp ?: null,
            'tested_wp'    => $tested_wp ?: null,
            'requires_php' => $requires_php ?: null,
        ];

        if ( $plugin_id > 0 ) {
            $result = $wpdb->update( $table, $data, [ 'id' => $plugin_id ], [ '%s', '%s', '%s', '%s', '%s', '%s', '%s' ], [ '%d' ] );
            if ( false === $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to update plugin.', 'fp-licensing-server' ), $plugin_id );
                return;
            }
            $this->redirect_with_notice( 'updated', __( 'Plugin updated.', 'fp-licensing-server' ) );
        } else {
            // Check for duplicate slug.
            $existing = $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE slug = %s", $slug ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            if ( $existing ) {
                $this->redirect_with_notice( 'error', __( 'A plugin with this slug already exists.', 'fp-licensing-server' ), 0, 'add' );
                return;
            }
            $result = $wpdb->insert( $table, $data, [ '%s', '%s', '%s', '%s', '%s', '%s', '%s' ] );
            if ( ! $result ) {
                $this->redirect_with_notice( 'error', __( 'Failed to add plugin.', 'fp-licensing-server' ), 0, 'add' );
                return;
            }
            $this->redirect_with_notice( 'updated', __( 'Plugin added.', 'fp-licensing-server' ) );
        }
    }

    private function handle_poll( int $plugin_id ): void {
        if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ), 'finn_poll_plugin_' . $plugin_id ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        $success = Finn_GitHub_Poller::poll_plugin_by_id( $plugin_id );

        if ( $success ) {
            $this->redirect_with_notice( 'updated', __( 'Release data updated from GitHub.', 'fp-licensing-server' ) );
        } else {
            $this->redirect_with_notice( 'error', __( 'Could not retrieve release data from GitHub. Check that the repo is correct, a release exists, and the GitHub token is set in Settings.', 'fp-licensing-server' ) );
        }
    }

    private function handle_delete( int $plugin_id ): void {
        if ( ! isset( $_GET['_wpnonce'] ) || ! wp_verify_nonce( sanitize_key( $_GET['_wpnonce'] ), 'finn_delete_plugin_' . $plugin_id ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fp-licensing-server' ) );
        }

        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to perform this action.', 'fp-licensing-server' ) );
        }

        global $wpdb;

        // Update license assignments: remove this plugin_id from specific-access licenses.
        // Licenses that only had this plugin become unrestricted (plugin_access = 'all').
        $licenses_table = $wpdb->prefix . 'finn_licenses';
        $licenses       = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, product_ids FROM {$licenses_table} WHERE plugin_access = 'specific' AND product_ids LIKE %s", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                '%' . $wpdb->esc_like( (string) $plugin_id ) . '%'
            )
        );

        foreach ( $licenses as $license ) {
            $ids = array_filter( array_map( 'absint', explode( ',', $license->product_ids ) ) );
            $ids = array_diff( $ids, [ $plugin_id ] );

            if ( empty( $ids ) ) {
                // No plugins left — make it unrestricted.
                $wpdb->update(
                    $licenses_table,
                    [ 'plugin_access' => 'all', 'product_ids' => null ],
                    [ 'id' => $license->id ],
                    [ '%s', null ],
                    [ '%d' ]
                );
            } else {
                $wpdb->update(
                    $licenses_table,
                    [ 'product_ids' => implode( ',', $ids ) ],
                    [ 'id' => $license->id ],
                    [ '%s' ],
                    [ '%d' ]
                );
            }
        }

        $plugins_table = $wpdb->prefix . 'finn_products';
        $wpdb->delete( $plugins_table, [ 'id' => $plugin_id ], [ '%d' ] );

        $this->redirect_with_notice( 'updated', __( 'Plugin deleted. Affected license assignments have been updated.', 'fp-licensing-server' ) );
    }

    private function redirect_with_notice( string $type, string $message, int $plugin_id = 0, string $action = 'list' ): void {
        $base = admin_url( 'admin.php?page=finn-plugins' );

        if ( $plugin_id > 0 ) {
            $url = add_query_arg( [ 'action' => 'edit', 'plugin_id' => $plugin_id, 'notice' => $type, 'notice_msg' => rawurlencode( $message ) ], $base );
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
