"use strict";

const vscode = require("vscode");

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "rubricStudio.openProject",
    () => {
      void vscode.env.openExternal(
        vscode.Uri.parse("https://auraone.ai/open/rubric-studio-open"),
      );
    },
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
