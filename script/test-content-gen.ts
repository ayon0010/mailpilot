// scripts/test-content-gen.ts

import { generateWarmupContent } from "@/lib/contentGenerator";


async function main() {
  const recent: string[] = [];
  for (let i = 0; i < 5; i++) {
    const c = await generateWarmupContent(recent, {});
    console.log(c.subject, "|", c.body);
    recent.push(c.body);
  }
}

main();