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
 * Re-checks the key whenever the settings are saved.
 */
function freeabtest_after_save() {
	freeabtest_refresh_status( true );
}
add_action( 'add_option_' . FREEABTEST_OPTION, 'freeabtest_after_save' );
add_action( 'update_option_' . FREEABTEST_OPTION, 'freeabtest_after_save' );

/**
 * Keeps the daily check scheduled (also on sites of a network where the plugin was network activated).
 */
function freeabtest_ensure_cron() {
	if ( ! wp_next_scheduled( FREEABTEST_CRON_HOOK ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', FREEABTEST_CRON_HOOK );
	}
}
add_action( 'admin_init', 'freeabtest_ensure_cron' );

/**
 * Text for the connection status of the active key.
 *
 * @param array $settings Settings.
 * @return array{ok: bool, text: string}
 */
function freeabtest_status_text( $settings ) {
	if ( '' === freeabtest_active_key( $settings ) ) {
		return array(
			'ok'   => false,
			'text' => __( 'Not connected. Paste your public SDK key and save to connect this site.', 'freeabtest' ),
		);
	}
	$status = freeabtest_get_status( $settings );
	$code   = isset( $status['status'] ) ? $status['status'] : '';
	$known  = array(
		'ok'                 => __( 'Connected. The snippet is active on this site.', 'freeabtest' ),
		'invalid_key'        => __( 'This key is not valid. Copy the public SDK key from your freeabtest.com dashboard.', 'freeabtest' ),
		'suspended'          => __( 'This freeabtest.com account is suspended.', 'freeabtest' ),
		'not_paid'           => __( 'The WordPress plugin is available to paid users only. Upgrade your freeabtest.com plan to use it.', 'freeabtest' ),
		'no_domains'         => __( 'Add this site\'s domain in your freeabtest.com dashboard under Domains, then save again.', 'freeabtest' ),
		'domain_not_allowed' => __( 'This site\'s domain is not registered for this key. Add it in your freeabtest.com dashboard under Domains, then save again.', 'freeabtest' ),
		'unreachable'        => __( 'Could not reach freeabtest.com to check the key. The plugin will try again shortly.', 'freeabtest' ),
	);
	if ( isset( $known[ $code ] ) ) {
		return array(
			'ok'   => 'ok' === $code,
			'text' => $known[ $code ],
		);
	}
	return array(
		'ok'   => false,
		'text' => __( 'The key has not been checked yet. Save the settings to connect.', 'freeabtest' ),
	);
}

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
	freeabtest_refresh_status();
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
	$state     = freeabtest_status_text( $settings );
	$active    = $state['ok'] && $settings['enabled'];
	$name      = FREEABTEST_OPTION;
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'FreeABTest', 'freeabtest' ); ?></h1>
		<p><?php esc_html_e( 'This plugin adds your freeabtest.com snippet to every page. You install it once per site, and every future test runs through it. You never need to edit your theme.', 'freeabtest' ); ?></p>
		<?php if ( $connected ) : ?>
			<div class="notice notice-info"><p><?php esc_html_e( 'Your key was filled in from your freeabtest.com dashboard. Choose Save settings to finish connecting.', 'freeabtest' ); ?></p></div>
		<?php endif; ?>
		<div class="notice <?php echo esc_attr( $state['ok'] ? 'notice-success' : 'notice-warning' ); ?> inline" id="freeabtest-connection">
			<p><strong><?php esc_html_e( 'Connection:', 'freeabtest' ); ?></strong> <?php echo esc_html( $state['text'] ); ?></p>
		</div>
		<p>
			<strong><?php esc_html_e( 'Status:', 'freeabtest' ); ?></strong>
			<?php
			if ( $active ) {
				esc_html_e( 'The snippet is on. It loads early in the head of every page.', 'freeabtest' );
			} elseif ( $state['ok'] ) {
				esc_html_e( 'The snippet is off. Turn it on to start testing.', 'freeabtest' );
			} else {
				esc_html_e( 'The snippet is off until this site is connected to a paid freeabtest.com account.', 'freeabtest' );
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
