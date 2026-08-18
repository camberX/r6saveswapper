# R6 Save Swapper

Desktop app for swapping Rainbow Six Siege save files. Finds whichever profile you last used and lets you overwrite its saves with ones from a folder or another local account.

If you run an Unlock All Community u are free to use this, I do not care, I made it for myself mainly.

Credits: @evilkitten911 on Discord

Windows only. `R6SaveSwapper.exe` is portable, just run it. No install.

Before you swap anything:

- close siege
- Ubisoft Connect → Settings → General → disable **Enable cloud save synchronization for supported games**
- if it asks which save to use when launching siege, pick **Local save**
- swapped saves need an unlock all or they wont show in game

Might need admin if it cant write to the Ubisoft savegames folder.

## build it yourself

```
npm i
npm run build
```

exe ends up in `portable/`.

# Screenshot
<img width="851" height="658" alt="Screenshot 2026-08-18 122448" src="https://github.com/user-attachments/assets/98eb2c6d-4140-4eaa-be22-508a60415fe3" />
