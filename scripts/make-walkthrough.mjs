import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const source = process.argv[2];
if (!source) throw Error("Pass the directory of browser-captured product screenshots.");
const work = resolve("out/demo-build");
await mkdir(work, { recursive: true });
await mkdir("public/demo", { recursive: true });
const scenes = [
  ["landing.jpg", "PORTOVA / PRODUCT WALKTHROUGH", "Captured product screens - Portaldot V3 Testnet\nA creator workspace for tokens, collections, liquidity and proceeds."],
  ["token.jpg", "01 / REAL NATIVE ASSET", "Asset 9194: supply, metadata and runtime authorities.\nThese values are read from the Portaldot Assets pallet."],
  ["swap.jpg", "02 / REVIEW A LIVE QUOTE", "Runtime quote, pool reserves and minimum received.\nQuotes expire; signing requires a fresh guard before broadcast."],
  ["treasury.jpg", "03 / PROCEEDS WITHDRAWAL", "Review the recipient, exact amount and keep-alive fee budget.\nThe proceeds account must sign. No new transfer is shown here."],
  ["receipt.jpg", "04 / RECOVER AN OLD RECEIPT", "Historical swap: block 159687, extrinsic 1, verified finalized.\nRecovered beyond 24 blocks; saved receipts support JSON backups."],
];
for (let i = 0; i < scenes.length; i++) {
  const [image, title, caption] = scenes[i];
  await copyFile(resolve(source, image), resolve(work, `${i}.jpg`));
  await writeFile(resolve(work, `${i}-title.txt`), title);
  await writeFile(resolve(work, `${i}-caption.txt`), caption);
  const filter = `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:900:(ow-iw)/2:0:color=0x100f18,drawtext=fontfile='C\\:/Windows/Fonts/segoeuib.ttf':textfile=${i}-title.txt:fontcolor=0xc9a8ff:fontsize=25:x=38:y=748,drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':textfile=${i}-caption.txt:fontcolor=white:fontsize=23:line_spacing=12:x=38:y=795`;
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "10", "-i", `${i}.jpg`, "-t", "12", "-vf", filter, "-c:v", "libx264", "-threads", "2", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", `${i}.mp4`], { cwd: work, encoding: "utf8" });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || "FFmpeg failed.");
}
await writeFile(resolve(work, "concat.txt"), scenes.map((_, i) => `file '${i}.mp4'`).join("\n"));
const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-movflags", "+faststart", resolve("public/demo/portova-walkthrough.mp4")], { cwd: work, encoding: "utf8" });
if (result.status !== 0) throw Error(result.stderr || "Video concatenation failed.");
console.log("Created public/demo/portova-walkthrough.mp4 (60 seconds, captioned captured-screen walkthrough).");
