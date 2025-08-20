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
            return get_fields( $object['id'] );
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
