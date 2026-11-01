// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked, {
	languageOptions: {
		parserOptions: {
			projectService: true,
		},
	},
	rules: {
		"@typescript-eslint/no-unnecessary-condition": "off",
		"@typescript-eslint/no-unnecessary-type-arguments": "off",
		"@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
		"@typescript-eslint/no-duplicate-type-constituents": ["error", { ignoreUnions: true }],
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": [
			"error",
			{ enableAutofixRemoval: { imports: true }, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
		],
	},
});
