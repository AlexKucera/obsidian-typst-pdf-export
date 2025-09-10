/**
 * Modal validation orchestration
 * 
 * This class handles validation logic for the export configuration modal,
 * coordinating validation across all modal sections.
 */

import { ModalSection, ValidationResult } from './modalTypes';

/**
 * Handles validation orchestration for modal sections
 */
export class ModalValidator {
	
	/**
	 * Validates all sections and aggregates the results
	 * 
	 * @param sections - Array of modal sections to validate
	 * @returns ValidationResult with aggregated errors and warnings
	 */
	public validateAllSections(sections: ModalSection[]): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		sections.forEach(section => {
			if (section.validate) {
				const result = section.validate();
				errors.push(...result.errors);
				if (result.warnings) {
					warnings.push(...result.warnings);
				}
			}
		});
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
}