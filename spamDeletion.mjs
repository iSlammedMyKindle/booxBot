import { readFile } from "fs/promises";

// Helper function to create a case-insensitive regex from an array of strings
// Optionally applies custom pattern transformation for domains
const createRegexFromArray = (array, customTransformer = null) => {
    if (array.length === 0) {
        return new RegExp("^$"); // Matches nothing
    }

    const escapedItems = array.map((item) =>
        item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    );

    const patterns = customTransformer
        ? escapedItems.map(customTransformer)
        : escapedItems;

    return new RegExp(patterns.join("|"), "i");
};

// Create regex for domains with custom pattern transformation
const domainTransformer = (domain) =>
    domain.includes(".") ? domain : `${domain}(?:[\\s.,!?:;]|$)`;

// Read and parse blocked phrases asynchronously
const loadBlockedPhrases = async () => {
    try {
        const data = await readFile("./blocked_phrases.json", "utf8");
        // Everything should be lower-case; keys, values, everything. Doing this should make it agnostic to however keys are being handled
        return JSON.parse(data.toLocaleLowerCase());
    } catch (error) {
        console.error("Error loading blocked phrases:", error);
        // Return default structure if file fails to load
        return {
            scam_phrases: [],
            domains: [],
            patterns: [],
        };
    }
};

// Initialize blocked phrases data
let blockedPhrasesData = null;
let patternsRegex = null;
let scamPhrasesRegex = null;
let domainsRegex = null;

// Async initialization function
const initializeSpamDetector = async () => {
    // Initialize all regex
    blockedPhrasesData = await loadBlockedPhrases();

    // Blocked Patterns
    patternsRegex = createRegexFromArray(blockedPhrasesData.patterns);

    // Blocked Phrases
    // Create regex patterns using helper function
    scamPhrasesRegex = createRegexFromArray(blockedPhrasesData.scam_phrases);

    // Blocked website domains
    domainsRegex = createRegexFromArray(
        blockedPhrasesData.domains,
        domainTransformer,
    );
};

// Initialize on module load
await initializeSpamDetector().catch(console.error);

// Spam detection function
export const isSpamMessage = (message = "") => {
    const msgLower = (message ?? "").toLowerCase();
    // Ensure we have initialized data
    if (!blockedPhrasesData) {
        console.warn("Spam detector not initialized yet");
        return false;
    }

    // Check conditions:
    // (domains + patterns come out positive) OR (scam_phrases alone comes out positive)
    const domainsMatch = domainsRegex.test(msgLower);
    const patternsMatch = patternsRegex.test(msgLower);
    const scamPhrasesMatch = scamPhrasesRegex.test(msgLower);

    return (domainsMatch && patternsMatch) || scamPhrasesMatch;
};
