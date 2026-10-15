<?php
/**
 * Settings page. Loaded only in wp-admin.
 *
 * @package FreeABTest
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the setting with a sanitize callback.
 */
function freeabtest_register_settings() {
	register_setting(
		'freeabtest',
		FREEABTEST_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'freeabtest_sanitize_settings',
			'default'           => freeabtest_defaults(),
			'show_in_rest'      => false,
		)
	);
}
add_action( 'admin_init', 'freeabtest_register_settings' );

/**
 * Sanitizes and validates submitted settings. Invalid keys are rejected with a notice and the old key is kept.
 *
 * @param mixed $input Raw input.
 * @return array
 */
function freeabtest_sanitize_settings( $input ) {
	$old = freeabtest_get_settings();
	if ( ! current_user_can( 'manage_options' ) || ! is_array( $input ) ) {
		return $old;
	}
	$out                = freeabtest_defaults();
	$out['enabled']     = ! empty( $input['enabled'] );
	$out['environment'] = ( isset( $input['environment'] ) && 'dev' === $input['environment'] ) ? 'dev' : 'prod';

	foreach ( array( 'prod', 'dev' ) as $env ) {
		$field = 'key_' . $env;
		$value = isset( $input[ $field ] ) ? trim( sanitize_text_field( wp_unslash( $input[ $field ] ) ) ) : '';
		if ( '' === $value || freeabtest_is_valid_key( $value, $env ) ) {
			$out[ $field ] = $value;
			continue;
		}
		$out[ $field ] = $old[ $field ];
		add_settings_error(
			FREEABTEST_OPTION,
			'freeabtest_invalid_' . $env,
			'prod' === $env
				? __( 'That Production key is not valid. It starts with cro_pk_prod_ followed by 32 letters and numbers. Copy it from your freeabtest.com dashboard.', 'freeabtest' )
				: __( 'That Development key is not valid. It starts with cro_pk_dev_ followed by 32 letters and numbers. Copy it from your freeabtest.com dashboard.', 'freeabtest' )
		);
	}
	return $out;
}

/**
 * Adds the page under Settings.
 */
function freeabtest_admin_menu() {
	add_options_page(
		__( 'FreeABTest', 'freeabtest' ),
		__( 'FreeABTest', 'freeabtest' ),
		'manage_options',
		'freeabtest',
		'freeabtest_render_settings_page'
	);
}
add_action( 'admin_menu', 'freeabtest_admin_menu' );

/**
 * Adds a Settings link on the Plugins screen.
 *
 * @param array $links Action links.
 * @return array
 */
function freeabtest_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=freeabtest' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'freeabtest' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/freeabtest.php' ), 'freeabtest_action_links' );

/**
 * A key passed by the one-click connect link from the dashboard. It only prefills the form; saving still
 * needs the nonce-protected Save button. Read only for users who can manage options.
 *
 * @param string $env 'prod' or 'dev'.
 * @return string
 */
function freeabtest_connect_key( $env ) {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only check of the redirect flag after saving.
	if ( ! current_user_can( 'manage_options' ) || isset( $_GET['settings-updated'] ) ) {
		return '';
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only prefill; nothing is saved without the settings nonce.
	$raw = isset( $_GET[ 'freeabtest_' . $env ] ) ? sanitize_text_field( wp_unslash( $_GET[ 'freeabtest_' . $env ] ) ) : '';
	return freeabtest_is_valid_key( $raw, $env ) ? $raw : '';
}

/**
 * Renders the settings page.
 */
function freeabtest_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to change these settings.', 'freeabtest' ) );
	}
	$settings  = freeabtest_get_settings();
	$prefill   = array(
		'prod' => freeabtest_connect_key( 'prod' ),
		'dev'  => freeabtest_connect_key( 'dev' ),
	);
	$connected = '' !== $prefill['prod'] || '' !== $prefill['dev'];
	$values    = array(
		'prod' => '' !== $prefill['prod'] ? $prefill['prod'] : $settings['key_prod'],
		'dev'  => '' !== $prefill['dev'] ? $prefill['dev'] : $settings['key_dev'],
	);
	$enabled   = $connected ? true : (bool) $settings['enabled'];
	$active    = '' !== freeabtest_active_key( $settings ) && $settings['enabled'];
	$name      = FREEABTEST_OPTION;
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'FreeABTest', 'freeabtest' ); ?></h1>
		<p><?php esc_html_e( 'This plugin adds your freeabtest.com snippet to every page. You install it once per site, and every future test runs through it. You never need to edit your theme.', 'freeabtest' ); ?></p>
		<?php if ( $connected ) : ?>
			<div class="notice notice-info"><p><?php esc_html_e( 'Your key was filled in from your freeabtest.com dashboard. Choose Save settings to finish connecting.', 'freeabtest' ); ?></p></div>
		<?php endif; ?>
		<p>
			<strong><?php esc_html_e( 'Status:', 'freeabtest' ); ?></strong>
			<?php
			if ( $active ) {
				esc_html_e( 'The snippet is on. It loads early in the head of every page.', 'freeabtest' );
			} else {
				esc_html_e( 'The snippet is off. Add a key and turn it on to start testing.', 'freeabtest' );
			}
			?>
		</p>
		<form action="options.php" method="post">
			<?php settings_fields( 'freeabtest' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Snippet', 'freeabtest' ); ?></th>
					<td>
						<label for="freeabtest-enabled">
							<input type="checkbox" id="freeabtest-enabled" name="<?php echo esc_attr( $name ); ?>[enabled]" value="1" <?php checked( $enabled ); ?> />
							<?php esc_html_e( 'Add the snippet to my site', 'freeabtest' ); ?>
						</label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Environment', 'freeabtest' ); ?></th>
					<td>
						<fieldset>
							<label><input type="radio" name="<?php echo esc_attr( $name ); ?>[environment]" value="prod" <?php checked( 'prod', $settings['environment'] ); ?> /> <?php esc_html_e( 'Production', 'freeabtest' ); ?></label><br />
							<label><input type="radio" name="<?php echo esc_attr( $name ); ?>[environment]" value="dev" <?php checked( 'dev', $settings['environment'] ); ?> /> <?php esc_html_e( 'Development (for staging or local copies of your site)', 'freeabtest' ); ?></label>
						</fieldset>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="freeabtest-key-prod"><?php esc_html_e( 'Production SDK key', 'freeabtest' ); ?></label></th>
					<td>
						<input type="text" class="regular-text code" id="freeabtest-key-prod" name="<?php echo esc_attr( $name ); ?>[key_prod]" value="<?php echo esc_attr( $values['prod'] ); ?>" placeholder="cro_pk_prod_..." autocomplete="off" spellcheck="false" pattern="cro_pk_prod_[0-9A-Za-z]{32}" />
						<p class="description"><?php esc_html_e( 'Your public SDK key. It is safe to use on your site. Never paste a secret key (cro_sk_...).', 'freeabtest' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="freeabtest-key-dev"><?php esc_html_e( 'Development SDK key', 'freeabtest' ); ?></label></th>
					<td>
						<input type="text" class="regular-text code" id="freeabtest-key-dev" name="<?php echo esc_attr( $name ); ?>[key_dev]" value="<?php echo esc_attr( $values['dev'] ); ?>" placeholder="cro_pk_dev_..." autocomplete="off" spellcheck="false" pattern="cro_pk_dev_[0-9A-Za-z]{32}" />
						<p class="description"><?php esc_html_e( 'Optional. Used when Environment is Development.', 'freeabtest' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Save settings', 'freeabtest' ) ); ?>
		</form>
		<p>
			<?php
			printf(
				/* translators: %s: link to the freeabtest.com dashboard. */
				esc_html__( 'Find your keys in your %s under API keys.', 'freeabtest' ),
				'<a href="' . esc_url( FREEABTEST_APP_URL . '/settings/keys' ) . '" target="_blank" rel="noopener noreferrer">' . esc_html__( 'freeabtest.com dashboard', 'freeabtest' ) . '</a>'
			);
			?>
		</p>
	</div>
	<?php
}
