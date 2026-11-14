# Places Shared

Shared library package for the [Places](https://github.com/bobstanton/places) plugin.

Implementations belong here only when multiple Obsidian plugins use them.
Code used by one plugin stays in that plugin. Domain exports exclude Obsidian;
shared Obsidian adapters use explicit `places-shared/obsidian` exports.

Network requests support the consuming plugin's configured map providers, geocoding,
directions, image loading, and external data services. Provider selection, account,
API key, and payment requirements are documented by each consuming plugin.
