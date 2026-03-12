<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Finn_REST_API {

    const NAMESPACE   = 'finn/v1';
    const RATE_LIMIT  = 60;   // requests per window
    const RATE_WINDOW = HOUR_IN_SECONDS;

    public function __construct() {
        add_action( 'rest_api_init', [ $this, 'register_routes' ] );
    }

    public function register_routes(): void {
        register_rest_route( self::NAMESPACE, '/status', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'status' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( self::NAMESPACE, '/validate', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [ $this, 'validate' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'key'         => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'fingerprint' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
            ],
        ] );

        register_rest_route( self::NAMESPACE, '/products', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'products' ],
            'permission_callback' => '__return_true',
        ] );

        register_rest_route( self::NAMESPACE, '/update-check', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'update_check' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'product_id'  => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'license'     => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'fingerprint' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
            ],
        ] );

        register_rest_route( self::NAMESPACE, '/download', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [ $this, 'download' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'product_id'  => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'license'     => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
                'fingerprint' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
            ],
        ] );
    }

    public function status( WP_REST_Request $request ): WP_REST_Response {
        return new WP_REST_Response( [ 'status' => 'ok', 'version' => FP_LS_VERSION ], 200 );
    }

    public function validate( WP_REST_Request $request ): WP_REST_Response {
        $ip = $this->get_client_ip();

        if ( ! $this->check_rate_limit( $ip ) ) {
            return new WP_REST_Response( [ 'data' => [ 'valid' => false ] ], 429 );
        }

        $key         = $request->get_param( 'key' );
        $fingerprint = $request->get_param( 'fingerprint' );

        $valid = $this->is_valid_license( $key, $fingerprint );

        return new WP_REST_Response( [ 'data' => [ 'valid' => $valid ] ], 200 );
    }

    public function products( WP_REST_Request $request ): WP_REST_Response {
        if ( ! $this->check_api_key( $request ) ) {
            return new WP_REST_Response( [ 'message' => 'Unauthorized' ], 401 );
        }

        global $wpdb;
        $table = $wpdb->prefix . 'finn_products';

        $rows = $wpdb->get_results(
            "SELECT id, name, slug, latest_version AS version, description
             FROM {$table}
             WHERE download_url IS NOT NULL AND download_url != ''
             ORDER BY name ASC"
        );

        $products = array_map( function( $row ) {
            return [
                'id'          => (string) $row->id,
                'name'        => $row->name,
                'slug'        => $row->slug,
                'version'     => $row->version,
                'description' => $row->description,
            ];
        }, $rows );

        return new WP_REST_Response( $products, 200 );
    }

    public function update_check( WP_REST_Request $request ): WP_REST_Response {
        $product_id  = $request->get_param( 'product_id' );
        $license_key = $request->get_param( 'license' );
        $fingerprint = $request->get_param( 'fingerprint' );

        $no_update = new WP_REST_Response( [ 'version' => null ], 200 );

        $license = $this->get_validated_license( $license_key, $fingerprint );
        if ( ! $license ) {
            return $no_update;
        }

        if ( ! $this->license_covers_product( $license, $product_id ) ) {
            return $no_update;
        }

        $product = $this->get_product_by_id( $product_id );
        if ( ! $product || empty( $product->download_url ) ) {
            return $no_update;
        }

        $download_url = add_query_arg(
            [
                'product_id'  => $product_id,
                'license'     => $license_key,
                'fingerprint' => $fingerprint,
            ],
            get_rest_url( null, self::NAMESPACE . '/download' )
        );

        return new WP_REST_Response(
            [
                'version'      => $product->latest_version,
                'download_url' => $download_url,
                'tested'       => $product->tested_wp ?? '',
                'requires'     => $product->requires_wp ?? '',
                'requires_php' => $product->requires_php ?? '',
                'sections'     => [
                    'changelog' => $product->changelog ?? '',
                ],
            ],
            200
        );
    }

    public function download( WP_REST_Request $request ) {
        $product_id  = $request->get_param( 'product_id' );
        $license_key = $request->get_param( 'license' );
        $fingerprint = $request->get_param( 'fingerprint' );

        $license = $this->get_validated_license( $license_key, $fingerprint );
        if ( ! $license ) {
            return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
        }

        if ( ! $this->license_covers_product( $license, $product_id ) ) {
            return new WP_REST_Response( [ 'message' => 'Forbidden' ], 403 );
        }

        $product = $this->get_product_by_id( $product_id );
        if ( ! $product || empty( $product->download_url ) ) {
            return new WP_REST_Response( [ 'message' => 'Not Found' ], 404 );
        }

        // Stream the ZIP from GitHub through the server so the raw GitHub URL
        // is never exposed to the client.  Always fetches fresh (no server cache).
        $token    = Finn_Settings::get_github_token();
        $tmp_file = wp_tempnam( 'finn-dl-' );

        $args = [
            'timeout'     => 120,
            'stream'      => true,
            'filename'    => $tmp_file,
            'redirection' => 5,
            'headers'     => [
                'Accept'     => 'application/octet-stream',
                'User-Agent' => 'FINN-Licensing-Server/' . FP_LS_VERSION,
            ],
        ];

        if ( ! empty( $token ) ) {
            $args['headers']['Authorization'] = 'Bearer ' . $token;
        }

        $response = wp_remote_get( $product->download_url, $args );

        if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            @unlink( $tmp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            return new WP_REST_Response( [ 'message' => 'Download failed' ], 502 );
        }

        $file_size = filesize( $tmp_file );
        $handle    = fopen( $tmp_file, 'rb' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fopen

        // Disable any active output buffers so we stream directly.
        while ( ob_get_level() ) {
            ob_end_clean();
        }

        header( 'Content-Type: application/zip' );
        header( 'Content-Disposition: attachment; filename="plugin.zip"' );
        if ( $file_size ) {
            header( 'Content-Length: ' . $file_size );
        }

        fpassthru( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fpassthru
        fclose( $handle );    // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_read_fclose
        @unlink( $tmp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged

        exit;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function check_api_key( WP_REST_Request $request ): bool {
        $stored_key = Finn_Settings::get_api_key();
        if ( empty( $stored_key ) ) {
            return false;
        }

        $auth_header = $request->get_header( 'authorization' );
        if ( empty( $auth_header ) ) {
            return false;
        }

        if ( ! preg_match( '/^Bearer\s+(.+)$/i', $auth_header, $matches ) ) {
            return false;
        }

        return hash_equals( $stored_key, $matches[1] );
    }

    private function is_valid_license( string $key, string $fingerprint ): bool {
        global $wpdb;

        $table = $wpdb->prefix . 'finn_licenses';

        $license = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT status, domain FROM {$table} WHERE license_key = %s LIMIT 1",
                $key
            )
        );

        if ( ! $license ) {
            return false;
        }

        if ( 'Active' !== $license->status ) {
            return false;
        }

        $normalised_fingerprint = $this->normalise_domain( $fingerprint );
        $normalised_domain      = $this->normalise_domain( $license->domain );

        return $normalised_fingerprint === $normalised_domain;
    }

    private function normalise_domain( string $domain ): string {
        $domain = preg_replace( '#^https?://#i', '', trim( $domain ) );
        $domain = strtok( $domain, '/' );
        $domain = preg_replace( '/^www\./i', '', $domain );
        return strtolower( rtrim( $domain, '.' ) );
    }

    private function check_rate_limit( string $ip ): bool {
        $cache_key = 'finn_rl_' . md5( $ip );
        $count     = (int) get_transient( $cache_key );

        if ( $count >= self::RATE_LIMIT ) {
            return false;
        }

        if ( $count === 0 ) {
            set_transient( $cache_key, 1, self::RATE_WINDOW );
        } else {
            // Increment without resetting the expiry by updating the value.
            // get_transient above confirmed count < limit, so this is safe.
            $remaining = $this->get_transient_remaining( $cache_key );
            set_transient( $cache_key, $count + 1, $remaining > 0 ? $remaining : self::RATE_WINDOW );
        }

        return true;
    }

    private function get_transient_remaining( string $key ): int {
        // For object-cache backed sites the expiry is opaque; fall back to the
        // full window so the count still caps at RATE_LIMIT within that window.
        $option_timeout = get_option( '_transient_timeout_' . $key );
        if ( false === $option_timeout ) {
            return self::RATE_WINDOW;
        }
        return max( 0, (int) $option_timeout - time() );
    }

    /**
     * Validate a license key + fingerprint and return the license row, or null if invalid.
     *
     * @return object|null
     */
    private function get_validated_license( string $key, string $fingerprint ) {
        global $wpdb;

        $table   = $wpdb->prefix . 'finn_licenses';
        $license = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT status, domain, plugin_access, product_ids FROM {$table} WHERE license_key = %s LIMIT 1",
                $key
            )
        );

        if ( ! $license ) {
            return null;
        }

        if ( 'active' !== $license->status ) {
            return null;
        }

        $normalised_fingerprint = $this->normalise_domain( $fingerprint );
        $normalised_domain      = $this->normalise_domain( $license->domain );

        if ( $normalised_fingerprint !== $normalised_domain ) {
            return null;
        }

        return $license;
    }

    /**
     * Check whether a validated license covers a given product_id.
     */
    private function license_covers_product( object $license, string $product_id ): bool {
        if ( 'all' === $license->plugin_access ) {
            return true;
        }

        if ( empty( $license->product_ids ) ) {
            return false;
        }

        $ids = array_map( 'trim', explode( ',', $license->product_ids ) );
        return in_array( $product_id, $ids, true );
    }

    /**
     * Fetch a product row by its id.
     *
     * @return object|null
     */
    private function get_product_by_id( string $product_id ) {
        global $wpdb;

        $table = $wpdb->prefix . 'finn_products';
        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT latest_version, download_url, changelog, requires_wp, tested_wp, requires_php FROM {$table} WHERE id = %d LIMIT 1",
                absint( $product_id )
            )
        );
    }

    private function get_client_ip(): string {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR',
        ];

        foreach ( $headers as $header ) {
            if ( ! empty( $_SERVER[ $header ] ) ) {
                $ip = trim( explode( ',', sanitize_text_field( wp_unslash( $_SERVER[ $header ] ) ) )[0] );
                if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
                    return $ip;
                }
            }
        }

        return '0.0.0.0';
    }
}
