<?php
/**
 * Removes the plugin options and the daily check on uninstall, on every site of a network.
 *
 * @package FreeABTest
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

if ( is_multisite() ) {
	$freeabtest_site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);
	foreach ( $freeabtest_site_ids as $freeabtest_site_id ) {
		switch_to_blog( $freeabtest_site_id );
		delete_option( 'freeabtest_settings' );
		delete_option( 'freeabtest_status' );
		wp_clear_scheduled_hook( 'freeabtest_daily_check' );
		restore_current_blog();
	}
} else {
	delete_option( 'freeabtest_settings' );
	delete_option( 'freeabtest_status' );
	wp_clear_scheduled_hook( 'freeabtest_daily_check' );
}
