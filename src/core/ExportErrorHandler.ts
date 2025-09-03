/**
 * Centralized error handling utilities for export operations
 */

import { Notice } from 'obsidian';
import { EXPORT_CONSTANTS } from './constants';

export interface BatchExportResult {
	successful: number;
	failed: number;
	errors: string[];
}

export interface ExportError {
	fileName?: string;
	operation: string;
	error: Error | string;
	shouldShowNotice?: boolean;
	logLevel?: 'error' | 'warn' | 'info';
}

export class ExportErrorHandler {
	/**
	 * Handle batch export results with consistent messaging
	 */
	public static handleBatchResult(
		result: BatchExportResult,
		operationDescription: string = 'Export'
	): void {
		const { successful, failed, errors } = result;
		
		if (failed === 0) {
			new Notice(`✓ Successfully exported ${successful} files`);
		} else {
			new Notice(
				`${operationDescription} complete: ${successful} successful, ${failed} failed`,
				EXPORT_CONSTANTS.NOTICE_DURATION.SHORT
			);
			
			if (errors.length > 0) {
				console.error(`${operationDescription} errors:`, errors);
			}
		}
	}

	/**
	 * Handle individual export errors consistently
	 */
	public static handleExportError(exportError: ExportError): string {
		const { fileName, operation, error, shouldShowNotice = false, logLevel = 'error' } = exportError;
		
		const errorMessage = error instanceof Error ? error.message : String(error);
		const fullMessage = fileName ? `${fileName}: ${errorMessage}` : errorMessage;
		
		// Log the error
		switch (logLevel) {
			case 'error':
				console.error(`${operation}:`, error);
				break;
			case 'warn':
				console.warn(`${operation}:`, error);
				break;
			case 'info':
				console.info(`${operation}:`, error);
				break;
		}
		
		// Show notice if requested
		if (shouldShowNotice) {
			new Notice(`${operation} failed: ${errorMessage}`);
		}
		
		return fullMessage;
	}

	/**
	 * Handle processing errors for embeds and similar operations
	 */
	public static handleProcessingError(
		operation: string,
		itemPath: string,
		error: Error | string,
		fallbackContent?: string
	): { errorMessage: string; fallback: string } {
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		console.error(`Export: Error processing ${operation} ${itemPath}:`, error);
		
		const fallback = fallbackContent || 
			`[⚠️ **${operation} processing error:** ${itemPath}]`;
		
		return {
			errorMessage: `${operation} processing failed: ${errorMessage}`,
			fallback
		};
	}

	/**
	 * Create a batch export tracker for consistent error collection
	 */
	public static createBatchTracker(): {
		tracker: BatchExportResult;
		recordSuccess: () => void;
		recordError: (fileName: string, error: Error | string) => void;
		getResult: () => BatchExportResult;
	} {
		const tracker: BatchExportResult = {
			successful: 0,
			failed: 0,
			errors: []
		};

		return {
			tracker,
			recordSuccess: () => {
				tracker.successful++;
			},
			recordError: (fileName: string, error: Error | string) => {
				tracker.failed++;
				const errorMessage = error instanceof Error ? error.message : String(error);
				tracker.errors.push(`${fileName}: ${errorMessage}`);
				
				// Also log individual errors
				console.error(`Failed to export ${fileName}:`, error);
			},
			getResult: () => tracker
		};
	}

	/**
	 * Handle single file export errors with proper notices
	 */
	public static handleSingleExportError(error: Error | string): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Export error:', error);
		new Notice(`Export failed: ${errorMessage}`);
	}

	/**
	 * Handle dependency or configuration errors
	 */
	public static handleDependencyError(
		dependency: string,
		error: Error | string,
		showNotice: boolean = true
	): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error checking ${dependency}:`, error);
		
		if (showNotice) {
			new Notice(
				`${dependency} error: ${errorMessage}`,
				EXPORT_CONSTANTS.NOTICE_DURATION.LONG
			);
		}
	}

	/**
	 * Show export progress notice
	 */
	public static showProgressNotice(message: string, timeout?: number): Notice {
		return new Notice(message, timeout || 0);
	}

	/**
	 * Show export cancellation notice
	 */
	public static showCancellationNotice(): void {
		new Notice('Export cancelled');
	}
}