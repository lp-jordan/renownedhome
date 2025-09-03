<?php
/**
 * Simple placeholder dashboard for the Mini CMS.
 * Users must be logged in and have manage_options capability.
 */

if ( ! is_user_logged_in() ) {
    auth_redirect();
}

if ( ! current_user_can( 'manage_options' ) ) {
    wp_die( __( 'You do not have permission to access this page.' ) );
}

?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>" />
    <title><?php esc_html_e( 'Mini CMS Dashboard', 'renowned' ); ?></title>
    <?php wp_head(); ?>
</head>
<body>
<div class="wrap">
    <h1><?php esc_html_e( 'Mini CMS Dashboard', 'renowned' ); ?></h1>
    <form method="post">
        <?php wp_nonce_field( 'rh_mini_cms_save', 'rh_mini_cms_nonce' ); ?>
        <p>
            <label for="subtitle"><?php esc_html_e( 'Subtitle', 'renowned' ); ?></label><br />
            <input type="text" id="subtitle" name="subtitle" class="regular-text" />
        </p>
        <p>
            <label for="description"><?php esc_html_e( 'Description', 'renowned' ); ?></label><br />
            <textarea id="description" name="description" class="large-text" rows="5"></textarea>
        </p>
        <p>
            <label for="image_url"><?php esc_html_e( 'Image URL', 'renowned' ); ?></label><br />
            <input type="text" id="image_url" name="image_url" class="regular-text" />
        </p>
        <?php submit_button(); ?>
    </form>
</div>
<?php wp_footer(); ?>
</body>
</html>
