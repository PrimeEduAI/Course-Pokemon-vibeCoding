import HomeMenu from '@/components/home/HomeMenu'

export const dynamic = 'force-dynamic'

async function getCount() {
  try {
    const { getDb } = await import('@/lib/db')
    const { listCards } = await import('@/lib/collection')
    return listCards(getDb()).length
  } catch { return 0 }
}

export default async function Home() {
  const count = await getCount()
  return <HomeMenu count={count} />
}
