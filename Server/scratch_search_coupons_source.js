import fs from "fs";
import path from "path";

const dir = "D:/Nextjs/Projects/Bookvardi";
const targets = ["SAVEMORE", "BACK2SCHOOL", "UNIFORM15", "FLAT100OFF", "FESTIVE30", "SCHOOL10", "STUDENT50", "FREESHIP"];

function searchDir(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git" || file === ".next" || file === "dist" || file === "build") continue;
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".jsx") || file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".json")) {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const target of targets) {
        if (content.includes(target)) {
          console.log(`FOUND '${target}' IN FILE:`, fullPath);
        }
      }
    }
  }
}

searchDir(dir);
