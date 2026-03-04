# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  channel = "stable-24.05";
  packages = [
    pkgs.nodejs_20
  ];
  env = {};
  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
      "bradlc.vscode-tailwindcss"
      "esbenp.prettier-vscode"
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        npm-install = "npm install";
        default.openFiles = [ "src/App.tsx" "src/pages/AddWinePage.tsx" ];
      };
      onStart = {};
    };
  };
}
