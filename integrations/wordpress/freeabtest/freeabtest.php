<?php
/**
 * Plugin Name:       FreeABTest
 * Plugin URI:        https://www.freeabtest.com/wordpress
 * Description:       Adds the freeabtest.com A/B testing snippet to your site. Install it once and every future test runs through it. Needs a paid freeabtest.com plan.
 * Version:           1.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            freeabtest.com
 * Author URI:        https://www.freeabtest.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       freeabtest
 *
 * @package FreeABTest
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'FREEABTEST_VERSION', '1.1.0' );
define( 'FREEABTEST_OPTION', 'freeabtest_settings' );
define( 'FREEABTEST_STATUS_OPTION', 'freeabtest_status' );
define( 'FREEABTEST_CRON_HOOK', 'freeabtest_daily_check' );
define( 'FREEABTEST_RECHECK_SECONDS', 12 * HOUR_IN_SECONDS );
define( 'FREEABTEST_SDK_URL', 'https://www.freeabtest.com/sdk.js' );
define( 'FREEABTEST_APP_URL', 'https://www.freeabtest.com' );

/**
 * Default settings.
 *
 * @return array{enabled: bool, environment: string, key_prod: string, key_dev: string}
 */
function freeabtest_defaults() {
	return array(
		'enabled'     => false,
		'environment' => 'prod',
		'key_prod'    => '',
		'key_dev'     => '',
	);
}

/**
 * Saved settings merged with defaults.
 *
 * @return array{enabled: bool, environment: string, key_prod: string, key_dev: string}
 */
function freeabtest_get_settings() {
	$saved = get_option( FREEABTEST_OPTION, array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return array_merge( freeabtest_defaults(), array_intersect_key( $saved, freeabtest_defaults() ) );
}

/**
 * Validates a public SDK key for an environment. Only public keys are accepted, never secret keys.
 *
 * @param string $key         Candidate key.
 * @param string $environment Either 'prod' or 'dev'.
 * @return bool
 */
function freeabtest_is_valid_key( $key, $environment ) {
	if ( ! is_string( $key ) || ! in_array( $environment, array( 'prod', 'dev' ), true ) ) {
		return false;
	}
	return 1 === preg_match( '/^cro_pk_' . $environment . '_[0-9A-Za-z]{32}$/', $key );
}

/**
 * The key for the selected environment, or an empty string when it is not valid.
 *
 * @param array $settings Settings.
 * @return string
 */
function freeabtest_active_key( $settings ) {
	$env = 'dev' === $settings['environment'] ? 'dev' : 'prod';
	$key = 'dev' === $env ? $settings['key_dev'] : $settings['key_prod'];
	return freeabtest_is_valid_key( $key, $env ) ? $key : '';
}

/**
 * Fingerprint of a key, so the saved connection status always belongs to the key in use.
 *
 * @param string $key Key.
 * @return string
 */
function freeabtest_key_hash( $key ) {
	return hash( 'sha256', (string) $key );
}

/**
 * Saved connection status for the active key, or an empty array when the key has not been checked.
 *
 * @param array $settings Settings.
 * @return array{status?: string, message?: string, key_hash?: string, checked?: int}
 */
function freeabtest_get_status( $settings ) {
	$key    = freeabtest_active_key( $settings );
	$status = get_option( FREEABTEST_STATUS_OPTION, array() );
	if ( '' === $key || ! is_array( $status ) || ! isset( $status['key_hash'] ) || freeabtest_key_hash( $key ) !== $status['key_hash'] ) {
		return array();
	}
	return $status;
}

/**
 * True when freeabtest.com confirmed the active key for this site: a valid key, a paid plan and a registered domain.
 *
 * @param array $settings Settings.
 * @return bool
 */
function freeabtest_is_connected( $settings ) {
	$status = freeabtest_get_status( $settings );
	return isset( $status['status'] ) && 'ok' === $status['status'];
}

/**
 * Asks freeabtest.com whether a key may be used on this site.
 *
 * @param string $key Public SDK key.
 * @return array{status: string, message: string}|null Null when freeabtest.com could not be reached.
 */
function freeabtest_remote_verify( $key ) {
	$response = wp_remote_post(
		FREEABTEST_APP_URL . '/api/plugin/verify',
		array(
			'timeout' => 8,
			'headers' => array( 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode(
				array(
					'key'            => $key,
					'site_url'       => home_url( '/' ),
					'plugin_version' => FREEABTEST_VERSION,
				)
			),
		)
	);
	if ( is_wp_error( $response ) ) {
		return null;
	}
	$code = (int) wp_remote_retrieve_response_code( $response );
	if ( 429 === $code || $code >= 500 ) {
		return null;
	}
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $body ) || ! isset( $body['status'] ) || ! is_string( $body['status'] ) ) {
		return null;
	}
	return array(
		'status'  => sanitize_key( $body['status'] ),
		'message' => isset( $body['message'] ) && is_string( $body['message'] ) ? sanitize_text_field( $body['message'] ) : '',
	);
}

/**
 * Checks the active key with freeabtest.com and saves the result. When freeabtest.com cannot be reached the
 * last answer for the same key is kept, so a short outage does not switch a working site off.
 *
 * @param bool $force Check even when the last check is recent.
 */
function freeabtest_refresh_status( $force = false ) {
	$settings = freeabtest_get_settings();
	$key      = freeabtest_active_key( $settings );
	if ( '' === $key ) {
		delete_option( FREEABTEST_STATUS_OPTION );
		return;
	}
	$current = freeabtest_get_status( $settings );
	if ( ! $force && isset( $current['checked'] ) && ( time() - (int) $current['checked'] ) < FREEABTEST_RECHECK_SECONDS ) {
		return;
	}
	$result = freeabtest_remote_verify( $key );
	if ( null === $result ) {
		if ( empty( $current ) ) {
			update_option(
				FREEABTEST_STATUS_OPTION,
				array(
					'status'   => 'unreachable',
					'message'  => '',
					'key_hash' => freeabtest_key_hash( $key ),
					'checked'  => time() - FREEABTEST_RECHECK_SECONDS + HOUR_IN_SECONDS,
				),
				false
			);
		}
		return;
	}
	update_option(
		FREEABTEST_STATUS_OPTION,
		array(
			'status'   => $result['status'],
			'message'  => $result['message'],
			'key_hash' => freeabtest_key_hash( $key ),
			'checked'  => time(),
		),
		false
	);
}
add_action( FREEABTEST_CRON_HOOK, 'freeabtest_refresh_status' );

/**
 * Prints the snippet early in the head, only when enabled and freeabtest.com confirmed the key for this site.
 */
function freeabtest_print_snippet() {
	if ( is_admin() || is_feed() ) {
		return;
	}
	$settings = freeabtest_get_settings();
	if ( empty( $settings['enabled'] ) ) {
		return;
	}
	$key = freeabtest_active_key( $settings );
	if ( '' === $key || ! freeabtest_is_connected( $settings ) ) {
		return;
	}
	wp_print_script_tag(
		array(
			'src'      => FREEABTEST_SDK_URL,
			'data-key' => $key,
			'data-via' => 'wp',
			'async'    => true,
		)
	);
}
add_action( 'wp_head', 'freeabtest_print_snippet', 1 );

/**
 * Creates the single autoloaded option on activation.
 */
function freeabtest_activate() {
	add_option( FREEABTEST_OPTION, freeabtest_defaults(), '', true );
	if ( ! wp_next_scheduled( FREEABTEST_CRON_HOOK ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', FREEABTEST_CRON_HOOK );
	}
}
register_activation_hook( __FILE__, 'freeabtest_activate' );

/**
 * Stops the daily key check.
 */
function freeabtest_deactivate() {
	wp_clear_scheduled_hook( FREEABTEST_CRON_HOOK );
}
register_deactivation_hook( __FILE__, 'freeabtest_deactivate' );

if ( is_admin() ) {
	require_once __DIR__ . '/includes/admin.php';
}
