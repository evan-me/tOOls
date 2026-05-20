function resolveRuntimePolicy({ isPackaged, argv = [] } = {}) {
  const normalizedArgv = Array.isArray(argv) ? argv : [];
  const openMainWindowOnLaunch = !normalizedArgv.includes("--start-hidden");

  return {
    openMainWindowOnLaunch,
    preloadQuickSheetWindow: false,
  };
}

module.exports = {
  resolveRuntimePolicy,
};
