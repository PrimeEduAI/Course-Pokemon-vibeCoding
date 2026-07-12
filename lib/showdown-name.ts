/** PokéAPI/TCG 名稱 → Showdown sprite 檔名 id（小寫、去標點、♀♂ → f/m、去變音符號） */
export function toShowdownId(name: string): string {
  return name
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}
