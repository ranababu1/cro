<?php
/**
 * Plugin Name:       FreeABTest
 * Plugin URI:        https://www.freeabtest.com/wordpress
 * Description:       Adds the freeabtest.com A/B testing snippet to your site. Install it once and every future test runs through it.
 * Version:           1.0.0
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

define( 'FREEABTEST_VERSION', '1.0.0' );
define( 'FREEABTEST_OPTION', 'freeabtest_settings' );
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
 * Prints the snippet early in the head, only when enabled and a valid key is set.
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
	if ( '' === $key ) {
		return;
	}
	wp_print_script_tag(
		array(
			'src'      => FREEABTEST_SDK_URL,
			'data-key' => $key,
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
}
register_activation_hook( __FILE__, 'freeabtest_activate' );

if ( is_admin() ) {
	require_once __DIR__ . '/includes/admin.php';
}
