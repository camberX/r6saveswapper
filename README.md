# R6 Save Swapper

Desktop app for swapping Rainbow Six Siege save files. Finds whichever profile you last used and lets you overwrite its saves with ones from a folder or another local account.

Credits: @evilkitten911 on Discord

Windows only. `R6SaveSwapper.exe` is portable, just run it. No install.

Before you swap anything:

- close siege
- Ubisoft Connect → Settings → General → disable **Enable cloud save synchronization for supported games**
- if it asks which save to use, pick **Local save**
- swapped saves need an unlock all or they wont show in game

Might need admin if it cant write to the Ubisoft savegames folder.

## build it yourself

```
npm i
npm run build
```

exe ends up in `portable/`.
