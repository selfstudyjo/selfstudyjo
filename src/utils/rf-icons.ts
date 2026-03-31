import { h, type Component } from 'vue';

// ===== Navigation & Action Icons =====

export const RfIconFolder: Component = {
  name: 'RfIconFolder',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' })
    ]);
  }
};

export const RfIconSearch: Component = {
  name: 'RfIconSearch',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' })
    ]);
  }
};

export const RfIconLibrary: Component = {
  name: 'RfIconLibrary',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z' })
    ]);
  }
};

export const RfIconCollab: Component = {
  name: 'RfIconCollab',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' })
    ]);
  }
};

export const RfIconAdd: Component = {
  name: 'RfIconAdd',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z' })
    ]);
  }
};

export const RfIconGlobe: Component = {
  name: 'RfIconGlobe',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z' })
    ]);
  }
};

export const RfIconPeople: Component = {
  name: 'RfIconPeople',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z' })
    ]);
  }
};

export const RfIconProfile: Component = {
  name: 'RfIconProfile',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
    ]);
  }
};

export const RfIconStats: Component = {
  name: 'RfIconStats',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z' })
    ]);
  }
};

export const RfIconFile: Component = {
  name: 'RfIconFile',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z' })
    ]);
  }
};

export const RfIconComment: Component = {
  name: 'RfIconComment',
  render() {
    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' })
    ]);
  }
};

export const RfIconDownload: Component = {
  name: 'RfIconDownload',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z' })
    ]);
  }
};

export const RfIconUpload: Component = {
  name: 'RfIconUpload',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z' })
    ]);
  }
};

export const RfIconEdit: Component = {
  name: 'RfIconEdit',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' })
    ]);
  }
};

export const RfIconDelete: Component = {
  name: 'RfIconDelete',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z' })
    ]);
  }
};

export const RfIconLink: Component = {
  name: 'RfIconLink',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z' })
    ]);
  }
};

export const RfIconSave: Component = {
  name: 'RfIconSave',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z' })
    ]);
  }
};

export const RfIconEye: Component = {
  name: 'RfIconEye',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z' })
    ]);
  }
};

export const RfIconCalendar: Component = {
  name: 'RfIconCalendar',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z' })
    ]);
  }
};

export const RfIconCrown: Component = {
  name: 'RfIconCrown',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z' })
    ]);
  }
};

export const RfIconCheck: Component = {
  name: 'RfIconCheck',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' })
    ]);
  }
};

export const RfIconClose: Component = {
  name: 'RfIconClose',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' })
    ]);
  }
};

export const RfIconBack: Component = {
  name: 'RfIconBack',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z' })
    ]);
  }
};

export const RfIconInbox: Component = {
  name: 'RfIconInbox',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.11-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z' })
    ]);
  }
};

export const RfIconSend: Component = {
  name: 'RfIconSend',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' })
    ]);
  }
};

export const RfIconTime: Component = {
  name: 'RfIconTime',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z' })
    ]);
  }
};

export const RfIconUniversity: Component = {
  name: 'RfIconUniversity',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z' })
    ]);
  }
};

export const RfIconAttach: Component = {
  name: 'RfIconAttach',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z' })
    ]);
  }
};

export const RfIconFollowers: Component = {
  name: 'RfIconFollowers',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
    ]);
  }
};

export const RfIconLock: Component = {
  name: 'RfIconLock',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z' })
    ]);
  }
};

export const RfIconPublic: Component = {
  name: 'RfIconPublic',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' })
    ]);
  }
};

export const RfIconCitation: Component = {
  name: 'RfIconCitation',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z' })
    ]);
  }
};

export const RfIconOpenAccess: Component = {
  name: 'RfIconOpenAccess',
  render() {
    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5-2.28 0-4.27 1.54-4.84 3.75l1.94.48C9.38 3.91 10.56 3 12 3c1.65 0 3 1.35 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z' })
    ]);
  }
};

export const RfIconArrowRight: Component = {
  name: 'RfIconArrowRight',
  render() {
    return h('svg', { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'currentColor' }, [
      h('path', { d: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z' })
    ]);
  }
};