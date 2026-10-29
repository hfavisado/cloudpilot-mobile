{ pkgs, inputs, ... }:

let
  emPkgs = inputs.nixpkgs-emscripten.legacyPackages.${pkgs.stdenv.hostPlatform.system};
in
{
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    yarn.enable = true;
  };

  languages.java = {
    enable = true;
    jdk.package = pkgs.jdk21;
  };

  android = {
    enable = true;
    platforms.version = [ "36" ];
    buildTools.version = [ "35.0.0" "36.0.0" ];
    ndk.enable = false;
    emulator.enable = false;
    android-studio.enable = false;
  };

  # Xcode and CocoaPods come from the host; Nix cannot provide them.
  packages = [ pkgs.git emPkgs.emscripten emPkgs.binaryen pkgs.gnumake pkgs.python3 ];
}
