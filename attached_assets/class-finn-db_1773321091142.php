<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_DB {

    /**
     * Create required database tables on plugin activation.
     * Uses IF NOT EXISTS so re-activation is safe.
     */
    public static function create_tables(): void {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        $sql = [];

        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}finn_clients (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            company VARCHAR(255) DEFAULT NULL,
            email VARCHAR(255) DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) {$charset_collate};";

        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}finn_products (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            github_repo VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            latest_version VARCHAR(50) DEFAULT NULL,
            release_date DATETIME DEFAULT NULL,
            changelog LONGTEXT DEFAULT NULL,
            download_url TEXT DEFAULT NULL,
            requires_wp VARCHAR(20) DEFAULT NULL,
            tested_wp VARCHAR(20) DEFAULT NULL,
            requires_php VARCHAR(20) DEFAULT NULL,
            last_checked DATETIME DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY slug (slug)
        ) {$charset_collate};";

        $sql[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}finn_licenses (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            license_key CHAR(36) NOT NULL,
            client_id BIGINT UNSIGNED DEFAULT NULL,
            domain VARCHAR(255) NOT NULL,
            plugin_access VARCHAR(20) NOT NULL DEFAULT 'all',
            product_ids TEXT DEFAULT NULL,
            status ENUM('active','revoked') NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY license_key (license_key),
            KEY client_id (client_id)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        foreach ( $sql as $query ) {
            dbDelta( $query );
        }

        update_option( 'finn_ls_db_version', FP_LS_VERSION );
    }
}
