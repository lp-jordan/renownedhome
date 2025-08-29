<?php
/**
 * Custom functionality for issues post type with ACF REST support.
 */

// Register the "issues" custom post type with REST API support.
add_action( 'init', function() {
    register_post_type( 'issues', [
        'label'        => __( 'Issues', 'renowned' ),
        'public'       => true,
        'show_in_rest' => true,
        'supports'     => [ 'title', 'editor', 'thumbnail' ],
    ] );
} );

// Expose all ACF fields on the issues REST responses.
add_action( 'rest_api_init', function() {
    register_rest_field( 'issues', 'acf', [
        'get_callback' => function( $object ) {
            $post_id = $object['id'];
            error_log( "ACF: fetching fields for post {$post_id}" );
            try {
                $fields = get_fields( $post_id );
                if ( false === $fields ) {
                    error_log( "ACF: failed to fetch fields for post {$post_id}" );
                    return null;
                }
                error_log( "ACF: fetched fields for post {$post_id}" );
                return $fields;
            } catch ( \Throwable $e ) {
                error_log( "ACF: error fetching fields for post {$post_id}: " . $e->getMessage() );
                return null;
            }
        },
        'schema' => null,
    ] );
} );

// Example of registering local ACF field group with REST support enabled.
if ( function_exists( 'acf_add_local_field_group' ) ) {
    acf_add_local_field_group( [
        'key'         => 'group_issues_fields',
        'title'       => 'Issues Fields',
        'fields'      => [],
        'location'    => [
            [
                [
                    'param'    => 'post_type',
                    'operator' => '==',
                    'value'    => 'issues',
                ],
            ],
        ],
        'show_in_rest' => 1,
    ] );
}

/**
 * Create table for page hero subtitles and expose a REST endpoint.
 */
function rh_create_page_subtitles_table() {
    global $wpdb;
    $table_name      = $wpdb->prefix . 'page_subtitles';
    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        page_title varchar(191) NOT NULL,
        headline_content text NOT NULL,
        PRIMARY KEY  (id),
        UNIQUE KEY page_title (page_title)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );

    $defaults = [
        [ 'buy', 'Support Renowned Home by backing our upcoming Kickstarter campaign.' ],
        [ 'read', 'Explore the latest issue of Renowned Home.' ],
        [ 'meet', 'Learn about the team behind Renowned Home.' ],
        [ 'connect', 'Stay connected with Renowned Home.' ],
    ];

    foreach ( $defaults as $row ) {
        $wpdb->replace(
            $table_name,
            [
                'page_title'      => $row[0],
                'headline_content'=> $row[1],
            ],
            [ '%s', '%s' ]
        );
    }
}
add_action( 'after_switch_theme', 'rh_create_page_subtitles_table' );

add_action( 'rest_api_init', function() {
    register_rest_route( 'renowned/v1', '/page-subtitle/(?P<page>[a-z0-9-]+)', [
        'methods'             => WP_REST_Server::READABLE,
        'permission_callback' => '__return_true',
        'callback'            => function( WP_REST_Request $request ) {
            global $wpdb;
            $page  = sanitize_text_field( $request['page'] );
            $table = $wpdb->prefix . 'page_subtitles';
            $headline = $wpdb->get_var( $wpdb->prepare( "SELECT headline_content FROM $table WHERE page_title = %s", $page ) );

            if ( null === $headline ) {
                return new WP_Error( 'not_found', 'Page subtitle not found', [ 'status' => 404 ] );
            }

            return [
                'page'             => $page,
                'headline_content' => $headline,
            ];
        },
    ] );
} );
