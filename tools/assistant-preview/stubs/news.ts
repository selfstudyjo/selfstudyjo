/**
 * App 36's speech service, stubbed.
 *
 * `speechCapabilities` answers null, which `serverVoicesFor` reads as "no
 * server voice" — so the preview takes the DEVICE route and never tries to
 * fetch an MP3. That is the right choice for a screenshot: a headless browser
 * has no voices installed, so nothing is spoken either way, and a real capability
 * probe here would be a network call to a PythonAnywhere replica that would
 * either hang for twenty seconds or fail and print a console error nobody
 * should be reading in a layout harness.
 */
export const newsService = {
    async speechCapabilities() { return null; },
    async speech() { throw new Error('no speech in the preview'); },
};
