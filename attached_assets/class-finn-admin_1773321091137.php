<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_Admin {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'register_menu' ] );
    }

    public function register_menu(): void {
        add_menu_page(
            __( 'FINN Licensing', 'fp-licensing-server' ),
            __( 'FINN Licensing', 'fp-licensing-server' ),
            'manage_options',
            'finn-licensing',
            [ $this, 'render_dashboard' ],
            'dashicons-lock',
            80
        );
    }

    public function render_dashboard(): void {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'FINN Licensing', 'fp-licensing-server' ); ?></h1>
            <p><?php esc_html_e( 'Welcome to FINN Licensing Server. Use the menu to manage clients, licenses, and products.', 'fp-licensing-server' ); ?></p>
        </div>
        <?php
    }
}
