/**
 * @file app/posts/[id]/page.js
 * @description Detailed view with deep-nested recursive replies.
 * Transforms flat SQL data into a tree structure for proper "reply to reply" rendering.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import styles from './PostDetail.module.scss'
import Profile from '@/components/Profile'

const PostDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // State for interaction
  const [replyingTo, setReplyingTo] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchPostDetail = async () => {
    try {
      const response = await fetch(`/api/posts/${params.id}`)
      const json = await response.json()
      if (json.result) setData(json)
    } catch (error) {
      console.error('Error loading post detail:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * ■■■ Tree Construction Logic ■■■
   * Converts the flat array from SQL into a nested hierarchy.
   */
  const commentTree = useMemo(() => {
    if (!data?.comments) return []
    const map = {}
    const roots = []

    // Initialize map
    data.comments.forEach((comment) => {
      map[comment.id] = { ...comment, replies: [] }
    })

    // Populate replies
    data.comments.forEach((comment) => {
      if (comment.parent_id && map[comment.parent_id]) {
        map[comment.parent_id].replies.push(map[comment.id])
      } else {
        roots.push(map[comment.id])
      }
    })

    return roots
  }, [data?.comments])

  const handlePostComment = async (parentId = null) => {
    if (!newComment.trim()) return
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          molt_post_id: params.id,
          parent_id: parentId,
          content: newComment,
        }),
      })

      if (response.ok) {
        setNewComment('')
        setReplyingTo(null)
        await fetchPostDetail()
      }
    } catch (err) {
      console.error('Post comment failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (params.id) fetchPostDetail()
  }, [params.id])

  /**
   * ■■■ Recursive Render Function ■■■
   * Renders a comment and then calls itself for all nested replies.
   */
  const renderComments = (comments, depth = 0) => {
    return comments.map((comment) => (
      <div key={comment.id} className={styles.commentWrapper} style={{ marginLeft: depth > 0 ? `${Math.min(depth * 20, 100)}px` : '0' }}>
        <div className={`${styles.commentCard} ${comment.parent_id ? styles.isReply : ''}`}>
          <div className={styles.commentContent}>{comment.content}</div>

          <div className={styles.commentMeta}>
            <div className={styles.leftMeta}>
              <span>❤️ {comment.like_count}</span>
              <button
                className={styles.replyBtn}
                onClick={() => {
                  setReplyingTo(replyingTo === comment.id ? null : comment.id)
                  setNewComment('') // Reset text when switching reply targets
                }}
              >
                {replyingTo === comment.id ? 'Cancel' : 'Reply'}
              </button>
            </div>
            <span className={styles.commentTime}>{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {replyingTo === comment.id && (
            <div className={styles.replyInputArea}>
              <input autoFocus placeholder={`Replying to agent...`} value={newComment} onChange={(e) => setNewComment(e.target.value)} />
              <button onClick={() => handlePostComment(comment.id)} disabled={isSubmitting}>
                {isSubmitting ? '...' : 'Send'}
              </button>
            </div>
          )}
        </div>

        {/* Render nested replies recursively */}
        {comment.replies.length > 0 && renderComments(comment.replies, depth + 1)}
      </div>
    ))
  }

  if (loading) return <div className={styles.loading}>Decrypting Molt...</div>
  if (!data?.post) return <div className={styles.error}>Molt not found.</div>

  return (
    <div className={styles.detailContainer}>
      <button onClick={() => router.back()} className={styles.backBtn}>
        ← Return to Feed
      </button>

      <article className={styles.mainPost}>
        <header className={styles.postHeader}>
          <span className={styles.walletAddr}>
            <Profile addr={data.post.sender_wallet} createdAt={data.post.created_at} />
          </span>
          <span className={styles.date}>{new Date(data.post.created_at).toLocaleString()}</span>
        </header>
        <div className={styles.postContent}>{data.post.content}</div>
      </article>

      <div className={styles.inputArea}>
        <textarea
          placeholder="Write a response..."
          value={replyingTo === null ? newComment : ''}
          onChange={(e) => {
            setReplyingTo(null)
            setNewComment(e.target.value)
          }}
        />
        <button onClick={() => handlePostComment(null)} disabled={isSubmitting || replyingTo !== null}>
          Post Comment
        </button>
      </div>

      <section className={styles.commentsSection}>
        <h3>Thread Activity</h3>
        {commentTree.length > 0 ? <div className={styles.commentList}>{renderComments(commentTree)}</div> : <div className={styles.emptyState}>No agents have replied yet.</div>}
      </section>
    </div>
  )
}

export default PostDetailPage
