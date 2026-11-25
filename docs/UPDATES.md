# Desktop updates

MediaGuy checks GitHub Releases 10 seconds after launch and also has a manual check button in the title bar. It never downloads an update until the user chooses **Download update**. After download, the user chooses **Restart to install**.

## Publishing a release

1. Update the desktop version in the root package and lockfile, then update the frontend package version to match:

   ```powershell
   npm version 1.0.1 --no-git-tag-version
   npm --prefix vite-core version 1.0.1 --no-git-tag-version
   ```

   Replace `1.0.1` with the next stable version. Commit the version changes and all release changes.

2. Create and push a matching version tag:

   ```powershell
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

3. The `Desktop Releases` GitHub Actions workflow builds Windows first, then Linux, and uploads both platforms to the GitHub Release. Wait for both jobs to finish before announcing the release. Keep the release public and stable, not draft or prerelease.

The release workflow uses the repository-provided `GITHUB_TOKEN`; no personal access token or secret needs to be added. Electron-builder uploads the installer, `latest.yml`, and blockmap for Windows, plus AppImage update metadata for Linux.

## Supported install formats

- Windows NSIS installers download and install updates from the app.
- Linux AppImage builds download and install updates from the app.
- Linux `.deb` installs check GitHub Releases but open the release page for a manual download. Electron's updater cannot replace a system-managed Debian package safely.

A commit pushed to `main` is not an app release. Users receive updates only after a newer stable release is published with matching installers and metadata.

## Forks

A fork must set its own `repository.url` and `build.publish.owner` / `build.publish.repo` in the root `package.json`, and adjust the release workflow/versioning to match. Packaged apps then check that fork's GitHub Releases. Development runs do not contact GitHub for updates.
