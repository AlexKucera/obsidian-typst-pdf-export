/**
 * Centralized error handling utilities for export operations.
 *
 * This module provides a unified interface for handling all types of errors that
 * can occur during PDF export operations. It standardizes error logging, user
 * notifications, and error message formatting across the plugin.
 *
 * Key features:
 * - Consistent error messaging and logging
 * - Batch export result tracking and reporting
 * - User-facing notices with appropriate durations
 * - Support for different log levels (error, warn, info)
 * - Specialized handlers for different error types (dependency, processing, validation)
 */

import { Notice } from 'obsidian';
import { EXPORT_CONSTANTS } from './constants';

/**
 * Result summary for batch export operations.
 *
 * @property successful - Number of files exported successfully
 * @property failed - Number of files that failed to export
 * @property errors - Array of error messages for failed exports
 */
export interface BatchExportResult {
	successful: number;
	failed: number;
	errors: string[];
}

/**
 * Structured error information for export operations.
 *
 * @property fileName - Optional file name where the error occurred
 * @property operation - Description of the operation that failed (e.g., "Pandoc conversion")
 * @property error - The error object or message
 * @property shouldShowNotice - Whether to display a user-facing notice (default: false)
 * @property logLevel - Logging severity level (default: 'error')
 */
export interface ExportError {
	fileName?: string;
	operation: string;
	error: Error | string;
	shouldShowNotice?: boolean;
	logLevel?: 'error' | 'warn' | 'info';
}

/**
 * Centralized error handler for all export-related errors.
 *
 * This class provides static utility methods for handling various error scenarios
 * in the PDF export pipeline. It ensures consistent error reporting to both users
 * (via Obsidian notices) and developers (via console logs).
 *
 * The handler supports:
 * - Single and batch export error tracking
 * - Context-specific error messages (dependencies, validation, processing)
 * - Configurable notice durations based on error severity
 * - Graceful error recovery with fallback content
 *
 * @example
 * ```typescript
 * // Handle single export error
 * try {
 *   await exportFile(file);
 * } catch (error) {
 *   ExportErrorHandler.handleSingleExportError(error);
 * }
 *
 * // Track batch export results
 * const batch = ExportErrorHandler.createBatchTracker();
 * for (const file of files) {
 *   try {
 *     await exportFile(file);
 *     batch.recordSuccess();
 *   } catch (error) {
 *     batch.recordError(file.name, error);
 *   }
 * }
 * ExportErrorHandler.handleBatchResult(batch.getResult(), 'Folder export');
 *
 * // Handle processing error with fallback
 * try {
 *   return await processImage(path);
 * } catch (error) {
 *   const { fallback } = ExportErrorHandler.handleProcessingError(
 *     'Image',
 *     path,
 *     error,
 *     '![Image unavailable]'
 *   );
 *   return fallback;
 * }
 * ```
 */
export class ExportErrorHandler {
	/**
	 * Displays batch export results with user-friendly summary messages.
	 *
	 * This method analyzes batch export results and shows appropriate notices
	 * based on the outcome. For fully successful exports, shows a success message.
	 * For partial or complete failures, shows a summary with counts and logs
	 * detailed errors to the console.
	 *
	 * @param result - The batch export result containing success/failure counts and errors
	 * @param operationDescription - Description of the operation (e.g., 'Export', 'Folder export')
	 *
	 * @example
	 * ```typescript
	 * const batch = { successful: 8, failed: 2, errors: ['file1: error', 'file2: error'] };
	 * ExportErrorHandler.handleBatchResult(batch, 'Folder export');
	 * // Shows: "Folder export complete: 8 successful, 2 failed"
	 * // Logs detailed errors to console
	 * ```
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
	 * Handles individual export errors with configurable logging and notifications.
	 *
	 * This method provides flexible error handling that supports different log levels
	 * and optional user notices. It normalizes error messages, logs them at the
	 * appropriate level, and optionally displays a notice to the user.
	 *
	 * @param exportError - Structured error information including operation context
	 * @returns Formatted error message string suitable for collection or display
	 *
	 * @example
	 * ```typescript
	 * // Handle with notice
	 * const message = ExportErrorHandler.handleExportError({
	 *   fileName: 'document.md',
	 *   operation: 'Pandoc conversion',
	 *   error: new Error('Invalid syntax'),
	 *   shouldShowNotice: true,
	 *   logLevel: 'error'
	 * });
	 * // Shows notice: "Pandoc conversion failed: Invalid syntax"
	 * // Returns: "document.md: Invalid syntax"
	 *
	 * // Handle silently (just logging)
	 * const message = ExportErrorHandler.handleExportError({
	 *   operation: 'Image processing',
	 *   error: 'File not found',
	 *   logLevel: 'warn'
	 * });
	 * // Logs warning but no notice
	 * ```
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
	 * Handles processing errors with fallback content generation.
	 *
	 * This method is designed for operations that can gracefully degrade when errors
	 * occur, such as embed processing or image handling. It logs the error and returns
	 * both an error message and fallback content to use in place of the failed operation.
	 *
	 * The fallback content ensures exports can continue even when individual embeds or
	 * resources fail to process, providing a visible indication of the failure in the
	 * output document.
	 *
	 * @param operation - Description of the operation (e.g., 'Image', 'PDF embed')
	 * @param itemPath - Path to the item being processed
	 * @param error - The error that occurred
	 * @param fallbackContent - Optional custom fallback content (auto-generated if not provided)
	 * @returns Object with error message and fallback content to use
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   return await processWikilink(link);
	 * } catch (error) {
	 *   const { fallback } = ExportErrorHandler.handleProcessingError(
	 *     'Wikilink',
	 *     '[[MyNote]]',
	 *     error,
	 *     '[Link unavailable]'
	 *   );
	 *   return fallback;  // Use fallback in output
	 * }
	 *
	 * // Without custom fallback
	 * const { fallback } = ExportErrorHandler.handleProcessingError(
	 *   'Image',
	 *   'path/to/image.png',
	 *   new Error('Not found')
	 * );
	 * // fallback: "[⚠️ **Image processing error:** path/to/image.png]"
	 * ```
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
	 * Creates a batch export tracker for systematic result collection.
	 *
	 * This method returns an object with methods to track successes and failures
	 * during batch export operations. It maintains counters and collects error
	 * messages, providing a clean API for recording results as exports progress.
	 *
	 * The tracker automatically logs individual errors to the console and formats
	 * error messages with file names for later reporting. Use getResult() to obtain
	 * the final BatchExportResult for display with handleBatchResult().
	 *
	 * @returns Object with tracker state and methods for recording results
	 *
	 * @example
	 * ```typescript
	 * const batch = ExportErrorHandler.createBatchTracker();
	 *
	 * for (const file of filesToExport) {
	 *   try {
	 *     await exportFile(file);
	 *     batch.recordSuccess();
	 *   } catch (error) {
	 *     batch.recordError(file.name, error);
	 *   }
	 * }
	 *
	 * // Display final results
	 * const result = batch.getResult();
	 * ExportErrorHandler.handleBatchResult(result, 'Folder export');
	 * // result: { successful: 8, failed: 2, errors: ['file1.md: Error message', ...] }
	 *
	 * // Direct access to tracker state
	 * console.log(`Progress: ${batch.tracker.successful} / ${filesToExport.length}`);
	 * ```
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
	 * Handles single file export errors with console logging and user notice.
	 *
	 * This is a convenience method for simple export error scenarios where the
	 * error should always be logged and shown to the user. Use this for single
	 * file exports or when you don't need the complexity of structured error handling.
	 *
	 * @param error - The error that occurred during export
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await exportCurrentNote();
	 * } catch (error) {
	 *   ExportErrorHandler.handleSingleExportError(error);
	 * }
	 * ```
	 */
	public static handleSingleExportError(error: Error | string): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Export error:', error);
		new Notice(`Export failed: ${errorMessage}`);
	}

	/**
	 * Handles dependency checking or configuration errors with optional notices.
	 *
	 * This method is specifically for errors that occur during dependency validation
	 * or configuration loading. It supports silent error handling (logging only) or
	 * user-visible notices with extended duration for readability.
	 *
	 * @param dependency - Name of the dependency or configuration item
	 * @param error - The error that occurred
	 * @param showNotice - Whether to display a user-facing notice (default: true)
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await checkPandocVersion();
	 * } catch (error) {
	 *   ExportErrorHandler.handleDependencyError('Pandoc', error);
	 * }
	 * ```
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
	 * Displays a progress or informational notice with configurable duration.
	 *
	 * @param message - The message to display
	 * @param timeout - Optional duration in milliseconds (0 = persist until dismissed)
	 * @returns The Notice object for potential manual dismissal
	 *
	 * @example
	 * ```typescript
	 * const notice = ExportErrorHandler.showProgressNotice('Exporting...', 0);
	 * await performExport();
	 * notice.hide();  // Dismiss when done
	 * ```
	 */
	public static showProgressNotice(message: string, timeout?: number): Notice {
		return new Notice(message, timeout || 0);
	}

	/**
	 * Displays a cancellation notice when user aborts an export operation.
	 *
	 * @example
	 * ```typescript
	 * if (userCancelled) {
	 *   ExportErrorHandler.showCancellationNotice();
	 * }
	 * ```
	 */
	public static showCancellationNotice(): void {
		new Notice('Export cancelled');
	}

	/**
	 * Displays a validation error for invalid settings or input.
	 *
	 * @param field - Name of the field that failed validation
	 * @param validationMessage - Explanation of why validation failed
	 *
	 * @example
	 * ```typescript
	 * if (pageSize < 0) {
	 *   ExportErrorHandler.showValidationError('page size', 'must be positive');
	 * }
	 * ```
	 */
	public static showValidationError(field: string, validationMessage: string): void {
		new Notice(`Invalid ${field}: ${validationMessage}`);
	}

	/**
	 * Displays an error when template loading fails.
	 *
	 * @param error - The error that occurred during template loading
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await loadTemplate(name);
	 * } catch (error) {
	 *   ExportErrorHandler.showTemplateError(error);
	 * }
	 * ```
	 */
	public static showTemplateError(error: Error | string): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Failed to load available templates: ${errorMessage}`);
	}

	/**
	 * Displays an error when font caching fails, with fallback notification.
	 *
	 * @param error - The error that occurred during font caching
	 * @param showFallback - Whether to show additional fallback notice (default: true)
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   await cacheSystemFonts();
	 * } catch (error) {
	 *   ExportErrorHandler.showFontError(error);
	 * }
	 * ```
	 */
	public static showFontError(error: Error | string, showFallback: boolean = true): void {
		const errorMessage = error instanceof Error ? error.message : String(error);
		new Notice(`Font caching failed: ${errorMessage}. Using fallback fonts.`, 5000);

		if (showFallback) {
			new Notice('Font list may be incomplete. Check debug mode for details.', 3000);
		}
	}

	/**
	 * Displays a success notice when export completes successfully.
	 *
	 * @param outputPath - Path where the PDF was saved
	 *
	 * @example
	 * ```typescript
	 * ExportErrorHandler.showExportSuccess('/path/to/output.pdf');
	 * ```
	 */
	public static showExportSuccess(outputPath: string): void {
		new Notice(`PDF exported successfully to ${outputPath}`);
	}

	/**
	 * Displays a warning when no active file is available for export.
	 *
	 * @param context - Description of the expected file type (e.g., 'Markdown')
	 *
	 * @example
	 * ```typescript
	 * if (!activeFile) {
	 *   ExportErrorHandler.showFileNotFoundWarning('Markdown');
	 * }
	 * ```
	 */
	public static showFileNotFoundWarning(context: string): void {
		new Notice(`Please open a ${context} file to export`);
	}

	/**
	 * Displays a warning when no files are available for batch export.
	 *
	 * @param context - Description of the file type (default: 'files')
	 *
	 * @example
	 * ```typescript
	 * if (files.length === 0) {
	 *   ExportErrorHandler.showNoFilesWarning('Markdown files');
	 * }
	 * ```
	 */
	public static showNoFilesWarning(context: string = 'files'): void {
		new Notice(`No ${context} to export`);
	}

	/**
	 * Displays a confirmation notice when settings are reset to defaults.
	 *
	 * @example
	 * ```typescript
	 * resetToDefaults();
	 * ExportErrorHandler.showSettingsReset();
	 * ```
	 */
	public static showSettingsReset(): void {
		new Notice('Settings reset to defaults');
	}
}