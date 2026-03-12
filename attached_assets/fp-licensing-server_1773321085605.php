<?php
/**
 * Plugin Name: FINN Licensing Server
 * Description: Central licensing authority and update gateway for FINN Partners plugins.
 * Version: 1.0.0
 * Author: Finn Partners
 * Author URI: https://finnpartners.com/
 * Requires PHP: 8.0
 * License: GNU General Public License v3 or later
 * License URI: http://www.gnu.org/licenses/gpl-3.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'FP_LS_VERSION', '1.0.0' );
define( 'FP_LS_PATH', plugin_dir_path( __FILE__ ) );
define( 'FP_LS_URL', plugin_dir_url( __FILE__ ) );

require_once FP_LS_PATH . 'includes/class-finn-db.php';
require_once FP_LS_PATH . 'includes/class-finn-admin.php';
require_once FP_LS_PATH . 'includes/class-finn-rest-api.php';
require_once FP_LS_PATH . 'includes/class-finn-products.php';
require_once FP_LS_PATH . 'includes/class-finn-clients.php';
require_once FP_LS_PATH . 'includes/class-finn-licenses.php';
require_once FP_LS_PATH . 'includes/class-finn-settings.php';
require_once FP_LS_PATH . 'includes/class-finn-github-poller.php';

register_activation_hook( __FILE__, [ 'Finn_DB', 'create_tables' ] );
// Intentionally no deactivation hook to drop tables — data is preserved on deactivation.

add_action( 'plugins_loaded', function() {
    new Finn_Admin();
    new Finn_REST_API();
    new Finn_Products();
    new Finn_Clients();
    new Finn_Licenses();
    new Finn_Settings();
    new Finn_GitHub_Poller();
} );
