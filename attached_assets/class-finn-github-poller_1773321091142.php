<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_GitHub_Poller {

    const CRON_HOOK     = 'finn_ls_poll_releases';
    const CRON_SCHEDULE = 'finn_ls_6hourly';

    public function __construct() {
        add_filter( 'cron_schedules', [ $this, 'add_cron_schedule' ] );
        add_action( 'init', [ $this, 'schedule_cron' ] );
        add_action( self::CRON_HOOK, [ $this, 'poll_all_products' ] );
    }

    public function add_cron_schedule( array $schedules ): array {
        $schedules[ self::CRON_SCHEDULE ] = [
            'interval' => 6 * HOUR_IN_SECONDS,
            'display'  => __( 'Every 6 Hours', 'fp-licensing-server' ),
        ];
        return $schedules;
    }

    public function schedule_cron(): void {
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), self::CRON_SCHEDULE, self::CRON_HOOK );
        }
    }

    public function poll_all_products(): void {
        global $wpdb;
        $table    = $wpdb->prefix . 'finn_products';
        $products = $wpdb->get_results( "SELECT * FROM {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        foreach ( $products as $product ) {
            self::do_poll( $product );
        }
    }

    /**
     * Poll a single product by ID. Used by "Check Now" in the admin screen.
     */
    public static function poll_product_by_id( int $product_id ): bool {
        global $wpdb;
        $table   = $wpdb->prefix . 'finn_products';
        $product = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $product_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        if ( ! $product ) {
            return false;
        }
        return self::do_poll( $product );
    }

    /**
     * Perform the actual GitHub API poll for a product row.
     *
     * Returns true on success (release found with .zip asset), false otherwise.
     * If no .zip asset exists the product's last_checked timestamp is still updated so we don't
     * keep hammering GitHub for the same release.
     */
    private static function do_poll( object $product ): bool {
        $token = Finn_Settings::get_github_token();
        $repo  = $product->github_repo;
        $url   = "https://api.github.com/repos/{$repo}/releases/latest";

        $args = [
            'headers' => [
                'Accept'     => 'application/vnd.github+json',
                'User-Agent' => 'FINN-Licensing-Server/' . FP_LS_VERSION,
            ],
            'timeout' => 15,
        ];

        if ( ! empty( $token ) ) {
            $args['headers']['Authorization'] = 'Bearer ' . $token;
        }

        $response = wp_remote_get( $url, $args );

        if ( is_wp_error( $response ) ) {
            return false;
        }

        $code = wp_remote_retrieve_response_code( $response );
        if ( 200 !== (int) $code ) {
            return false;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $body ) ) {
            return false;
        }

        // Find the first .zip release asset.
        $download_url = '';
        $assets       = $body['assets'] ?? [];
        foreach ( $assets as $asset ) {
            if ( isset( $asset['name'] ) && str_ends_with( strtolower( $asset['name'] ), '.zip' ) ) {
                $download_url = $asset['browser_download_url'] ?? '';
                break;
            }
        }

        global $wpdb;
        $table = $wpdb->prefix . 'finn_products';

        // If no .zip asset, flag by updating last_checked only — skip without error.
        if ( empty( $download_url ) ) {
            $wpdb->update(
                $table,
                [ 'last_checked' => current_time( 'mysql' ) ],
                [ 'id' => $product->id ],
                [ '%s' ],
                [ '%d' ]
            );
            return false;
        }

        $version      = ltrim( $body['tag_name'] ?? '', 'v' );
        $release_date = isset( $body['published_at'] )
            ? gmdate( 'Y-m-d H:i:s', strtotime( $body['published_at'] ) )
            : null;
        $changelog    = $body['body'] ?? '';

        $wpdb->update(
            $table,
            [
                'latest_version' => $version,
                'release_date'   => $release_date,
                'changelog'      => $changelog,
                'download_url'   => $download_url,
                'last_checked'   => current_time( 'mysql' ),
            ],
            [ 'id' => $product->id ],
            [ '%s', '%s', '%s', '%s', '%s' ],
            [ '%d' ]
        );

        return true;
    }
}
