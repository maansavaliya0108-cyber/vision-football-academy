// True in the GitHub Pages build, which is static: there is no API, so enquiries go out by WhatsApp
// and the staff dashboard is not available.
export const STATIC = import.meta.env.VITE_STATIC === 'true'
