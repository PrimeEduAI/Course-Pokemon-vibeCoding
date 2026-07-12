/** PokéAPI/TCG 名稱 → Showdown sprite 檔名 id（小寫、去標點） */
export function toShowdownId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
