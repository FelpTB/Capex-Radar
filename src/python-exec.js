const { spawn } = require("node:child_process");

// PYTHON_BIN aponta para o venv do build (nixpacks.toml); sem ele, o Python do sistema.
function pythonCommand() {
  if (process.env.PYTHON_BIN?.trim()) return process.env.PYTHON_BIN.trim();
  return process.platform === "win32" ? "py" : "python3";
}

function pythonArgs(extra = []) {
  if (process.platform === "win32" && !process.env.PYTHON_BIN?.trim()) return ["-3", ...extra];
  return extra;
}

function spawnPython(extraArgs, options) {
  return spawn(pythonCommand(), pythonArgs(extraArgs), options);
}

module.exports = { spawnPython, pythonCommand, pythonArgs };
