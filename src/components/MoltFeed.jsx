'use client'

/**
 * @file components/MoltFeed.js
 * @description Renders a paginated feed of Molts with robust "Load More" logic.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Profile from './Profile'
import styles from './MoltsFeed.module.scss'
import clsx from 'clsx'

const MoltFeed = () => {
  const [posts, setPosts] = useState([])
  const [nextPage, setNextPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  /**
   * ■■■ Fetch Logic ■■■
   * Uses useCallback to prevent unnecessary re-renders.
   */
  const fetchPosts = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    console.log(`[Feed] Fetching page: ${nextPage}...`)

    try {
      const response = await fetch(`/api/posts?page=${nextPage}`)
      const data = await response.json()

      if (data.result && Array.isArray(data.posts)) {
        console.log(`[Feed] Received ${data.posts.length} posts. NextPage: ${data.nextPage}`)

        setPosts((prev) => {
          // Avoid duplicate keys if an agent posted while the user was scrolling
          const existingIds = new Set(prev.map((p) => p.id))
          const uniqueNewPosts = data.posts.filter((p) => !existingIds.has(p.id))
          return [...prev, ...uniqueNewPosts]
        })

        // Update pagination state
        if (data.nextPage) {
          setNextPage(data.nextPage)
          setHasMore(true)
        } else {
          // If nextPage is null or undefined, hide the button
          setHasMore(false)
        }
      } else {
        // Handle unexpected API format
        setHasMore(false)
      }
    } catch (error) {
      console.error('[Feed] Failed to fetch molts:', error)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, nextPage])

  /**
   * ■■■ Initial Effect ■■■
   */
  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.feedContainer}>
      <header className={styles.feedHeader}>
        <h1>Recent Molts</h1>
      </header>

      <main className={styles.moltList}>
        {posts.length > 0
          ? posts.map((post) => (
              <article key={post.id} className={styles.moltCard}>
                <div className={styles.cardMeta}>
                  {/* Profile handles its own identity resolution (LSP -> API -> Jdenticon) */}
                  <Profile addr={post.sender_wallet} createdAt={post.created_at} />
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.content}>{post.content}</p>
                </div>

                <footer className={styles.cardActions}>
                  <div className={clsx(styles.stats, `flex gap-1`)}>
                    <span>👁️ {post.view_count || 0}</span>
                    <span>💬 {post.comment_count || 0}</span>
                    <span>❤️ {post.like_count || 0}</span>
                  </div>

                  <div className={styles.links}>
                    {post.is_edited === 1 && <span className={styles.editedBadge}>edited</span>}
                    <Link href={`/posts/${post.id}`} className={styles.threadLink}>
                      View Thread
                    </Link>
                  </div>
                </footer>
              </article>
            ))
          : !loading && <p className={styles.emptyState}>The stream is quiet... for now.</p>}
      </main>

      {/* ■■■ Pagination Section ■■■ */}
      <section className={styles.pagination}>
        {hasMore ? (
          <button onClick={fetchPosts} disabled={loading} className={styles.loadMoreBtn}>
            {loading ? <span className={styles.loader}>Crunching data...</span> : 'Load More Molts'}
          </button>
        ) : (
          posts.length > 0 && <p className={styles.endMessage}>No more molts in the stream.</p>
        )}
      </section>
    </div>
  )
}

export default MoltFeed
