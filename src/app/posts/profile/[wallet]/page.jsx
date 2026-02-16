'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getUniversalProfile,
  getProfile,
  updateProfile,
  subscribeUser,
  unsubscribeUser,
  sendNotification,
} from '@/lib/api'
import {
  initChatContract,
  getStatus,
  getCreatorPostCount,
  getMaxLength,
  getPostsByCreator,
} from '@/lib/communication'
import { toast } from '@/components/NextToast'
import Web3 from 'web3'
import { useClientMounted } from '@/hooks/useClientMount'
import Balance from './_components/balance'
import { getActiveChain } from '@/lib/communication'
import {
  useBalance,
  useWaitForTransactionReceipt,
  useConnection,
  useDisconnect,
  useWriteContract,
} from 'wagmi'
import moment from 'moment'
import PageTitle from '@/components/PageTitle'
import styles from './page.module.scss'


export default function Page() {
  const [posts, setPosts] = useState({ list: [] })
  const [postsLoaded, setPostsLoaded] = useState(0)
  const [isLoadedPoll, setIsLoadedPoll] = useState(false)
  const [totalPosts, setTotalPosts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [POAPs, setPOAPs] = useState()
  const [activeTab, setActiveTab] = useState('posts') // New state for active tab
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useConnection()
  const { web3, contract } = initChatContract()
  const activeChain = getActiveChain()
  const balance = useBalance({
    address: address,
  })
  const TABS_DATA = [
    { id: 'posts', label: 'Posts', count: totalPosts },
    { id: 'assets', label: 'Assets' },
    { id: 'reposts', label: 'Reposts' },
    { id: 'links', label: 'Links' },
    { id: 'settings', label: 'Settings' },
  ]
  const TabContentMap = {
    events: <></>,
    //  jobs: JobsTab,
    apps: <></>,
    // feed: FeedTab,
  }
  const ActiveComponent = TabContentMap[activeTab]




  useEffect(() => {




  }, [])

  return (
    <>
    <button onClick={() => router.back()} className={`${styles.backButton}`}>
      ← Back
    </button>
      <div className={`${styles.page} ms-motion-slideDownIn`}>
        <div className={`__container ${styles.page__container}`} data-width={`medium`}>
          <div className={`${styles.profileWrapper}`}>
            <Profile addr={params.wallet} />
 

          </div>


 <Links />
       <Balance addr={params.wallet} />




        </div>
      </div>
    </>
  )
}

/**
 * No data in tab content
 * @param {*} param0
 * @returns
 */
const NoData = ({ name }) => {
  return (
    <div className={`${styles.tabContent} ${styles.posts} d-f-c`}>
      <p style={{ color: `var(--gray-400)` }}>No {name} yet.</p>
    </div>
  )
}

/**
 * Profile
 * @param {String} addr
 * @returns
 */
const Profile = ({ addr }) => {
  const [data, setData] = useState()
  const [selfView, setSelfView] = useState()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isItUp, setIsItUp] = useState(false)
  const params = useParams()
  const { address, isConnected } = useConnection()
  const { disconnect } = useDisconnect()
  const activeChain = getActiveChain()

  /* Error during submission (e.g., user rejected)  */
  const { data: hash, isPending: isSigning, error: submitError, writeContract } = useWriteContract()
  /* Error after mining (e.g., transaction reverted) */
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  const follow = async () => toast(`Coming soon `, `warning`)

  const handleDisconnect = async () => {
    disconnect()

    // setTimeout(() => {
    //   window.location.reload()
    // }, 2000)
  }

  const Tags = ({ tags }) => {
    tags = JSON.parse(tags)
    if (tags === null) {
      return (
        <>
          <small>#profile</small>
          <small>#hup</small>
          <small>#social</small>
        </>
      )
    }

    let tagList = []
    tags.forEach((element) => {
      tagList.push(<small>#{element}</small>)
    })

    return <>{...tagList}</>
  }

  const editProfile = () => {
    console.log(isItUp)
    if (isItUp) {
      toast(`Please update your profile through Universal Profile`, `error`)
      return
    }
    setShowProfileModal(true)
  }

  useEffect(() => {
    getUniversalProfile(addr).then((res) => {
      if (
        res.data &&
        Array.isArray(res.data.Profile) &&
        res.data.Profile.length > 0 &&
        res.data.Profile[0].isContract
      ) {
        setIsItUp(true)
        setData({
          wallet: res.data.Profile[0].id,
          name: res.data.Profile[0].name,
          description: res.data.Profile[0].description,
          profileImage:
            res.data.Profile[0].profileImages.length > 0
              ? res.data.Profile[0].profileImages[0].src
              : '',
          profileHeader: '',
          tags: JSON.stringify(res.data.Profile[0].tags),
          links: JSON.stringify(res.data.Profile[0].links_),
          lastUpdate: '',
        })
        setSelfView(addr.toString().toLowerCase() === res.data.Profile[0].id.toLowerCase())
      } else {
        getProfile(addr).then((res) => {
          console.log(res, `==`)
          if (res.wallet) {
            res.profileImageName = res.profileImage
            const profileImage = `${process.env.NEXT_PUBLIC_UPLOAD_URL}${res.profileImage}`
            res.profileImage = profileImage
            setData(res)
            setSelfView(addr.toString().toLowerCase() === res.wallet.toLowerCase())
          }
        })
      }
    })
  }, [])

  if (!data) return <div className={`shimmer ${styles.shimmer}`} />

  return (
    <>
      {showProfileModal && data && (
        <ProfileModal profile={data} setShowProfileModal={setShowProfileModal} />
      )}

      <section
        className={`${styles.profile} relative flex flex-column align-items-start justify-content-start gap-1`}
      >
        <header className={`flex flex-row align-items-center justify-content-between gap-050`}>
          <div
            className={`flex-1 flex flex-column align-items-start justify-content-center gap-025`}
          >
            <div className={`${styles.profile__header}`}>
              <b className={styles.profile__name}>{data.name !== '' ? data.name : `hup-user`}</b>
            </div>

            <code className={`${styles.profile__wallet}`}>
              <Link
                href={`${activeChain[0].blockExplorers.default.url}/address/${data.wallet}`}
                target={`_blank`}
              >
                {`${data.wallet.slice(0, 4)}…${data.wallet.slice(38)}`}
              </Link>
            </code>

            <p className={`${styles.profile__description} mt-20`}>
              {data.description || `This user has not set up a bio yet.`}
            </p>

            <div
              className={`${styles.profile__tags} flex flex-row align-items-center flex-wrap gap-050`}
            >
              <Tags tags={data.tags} />
            </div>
          </div>
        </header>

        <footer className={`w-100`}>
          <ul className={`flex flex-column align-items-center justify-content-between gap-1`}>
            {isConnected && selfView && (
              <li className={`w-100 grid grid--fit gap-1`} style={{ '--data-width': `200px` }}>
                {address.toString().toLowerCase() === params.wallet.toString().toLowerCase() && (
                  <>
                    <button
                      className={`${styles.profile__btnFollow}`}
                      onClick={() => editProfile()}
                    >
                      Edit profile
                    </button>
                    <button
                      className={`${styles.profile__btnDisconnect}`}
                      onClick={() => handleDisconnect()}
                    >
                      Disconnect
                    </button>
                  </>
                )}
              </li>
            )}

            {!selfView && (
              <li className={`w-100 grid grid--fit gap-1`} style={{ '--data-width': `200px` }}>
                <button className={`${styles.profile__btnFollow}`} onClick={() => follow()}>
                  Follow
                </button>
              </li>
            )}
          </ul>
        </footer>
      </section>
    </>
  )
}
/**
 * Profile
 * @param {String} addr
 * @returns
 */
const Links = () => {
  const [data, setData] = useState()
  const [isItUp, setIsItUp] = useState()
  const params = useParams()

  useEffect(() => {
    getUniversalProfile(params.wallet).then((res) => {
      console.log(res)
      if (
        res.data &&
        Array.isArray(res.data.Profile) &&
        res.data.Profile.length > 0 &&
        res.data.Profile[0].isContract
      ) {
        setIsItUp(true)
        setData({
          wallet: res.data.Profile[0].id,
          name: res.data.Profile[0].name,
          description: res.data.Profile[0].description,
          profileImage:
            res.data.Profile[0].profileImages.length > 0
              ? res.data.Profile[0].profileImages[0].src
              : '',
          profileHeader: '',
          tags: JSON.stringify(res.data.Profile[0].tags),
          links: JSON.stringify(res.data.Profile[0].links),
          lastUpdate: '',
        })
      } else {
        getProfile(params.wallet).then((res) => {
          console.log(res, `==`)
          if (res.wallet) {
            res.profileImageName = res.profileImage
            const profileImage = `${process.env.NEXT_PUBLIC_UPLOAD_URL}${res.profileImage}`
            res.profileImage = profileImage
            setData(res)
          }
        })
      }
    })
  }, [])

  if (!data)
    return (
      <div className={`flex flex-column gap-1`}>
        <div className={`shimmer ${styles.linkShimmer}`} />
        <div className={`shimmer ${styles.linkShimmer}`} />
        <div className={`shimmer ${styles.linkShimmer}`} />
      </div>
    )

  if (JSON.parse(data.links).length < 1) return <NoData name={`links`} />

  return (
    <div className={`${styles.links}`}>
      {JSON.parse(data.links).length > 0 &&
        JSON.parse(data.links).map((link, i) => {
          return (
            <a
              key={i}
              href={`${!link.url.includes(`http`) ? `//${link.url}` : link.url}`}
              target={`_blank`}
              rel="noopener noreferrer"
              className={`flex flex-row align-items-center justify-content-between`}
            >
              <div className={`flex flex-column`}>
                <p>{link.title || link.name}</p>
                <code>{link.url}</code>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.16531 14.625L3.375 13.8347L11.9597 5.25H6.75V4.125H13.875V11.25H12.75V6.04031L4.16531 14.625Z"
                  fill="#424242"
                />
              </svg>
            </a>
          )
        })}
    </div>
  )
}
/**
 * Profile
 * @param {String} addr
 * @returns
 */
const Settings = () => {
  const handleSubscribe = async () => {
    const sw = await navigator.serviceWorker.ready
    const push = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: '',
    })
    console.log(JSON.stringify(push))
    return push
  }

  const readUserNotificationPermition = async () => {
    try {
      Notification.requestPermission().then((result) => {
        console.log(result)
        if (result === 'granted') {
          handleSubscribe().then((res) => {
            subscription(res, params.id).then((res) => {
              console.log(res)
              toast(`Notification has been enabled.`)
            })
          })
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className={`${styles.settings}`}>
      <div>
        <PushNotificationManager />
        <hr />
        <InstallPrompt />
      </div>
    </div>
  )
}

function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [message, setMessage] = useState('')
  const { address, isConnected } = useConnection()

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\\-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  async function registerServiceWorker() {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    const sub = await registration.pushManager.getSubscription()
    setSubscription(sub)
  }

  async function subscribeToPush() {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    })
    setSubscription(sub)
    await subscribeUser(sub, address)
  }

  async function unsubscribeFromPush() {
    await subscription?.unsubscribe()
    setSubscription(null)
    await unsubscribeUser()
  }

  async function sendTestNotification() {
    if (subscription) {
      await sendNotification(message, address)
      setMessage('')
    }
  }

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      registerServiceWorker()
    }
  }, [])

  if (!isSupported) {
    return <p>Push notifications are not supported in this browser.</p>
  }

  return (
    <div>
      <h3>Push Notifications</h3>
      {subscription ? (
        <>
          <p>You are subscribed to push notifications.</p>
          <button onClick={unsubscribeFromPush}>Unsubscribe</button>
          <input
            type="text"
            placeholder="Enter notification message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={sendTestNotification}>Send Test</button>
        </>
      ) : (
        <>
          <p>You are not subscribed to push notifications.</p>
          <button onClick={subscribeToPush}>Subscribe</button>
        </>
      )}
    </div>
  )
}

function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)

    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  if (isStandalone) {
    return null // Don't show install button if already installed
  }

  return (
    <div>
      <h3>Install App</h3>
      <button>Add to Home Screen</button>
      {isIOS && (
        <p>
          To install this app on your iOS device, tap the share button
          <span role="img" aria-label="share icon">
            {' '}
            ⎋{' '}
          </span>
          and then "Add to Home Screen"
          <span role="img" aria-label="plus icon">
            {' '}
            ➕{' '}
          </span>
          .
        </p>
      )}
    </div>
  )
}



/**
 * Profile Modal
 * @param {*} param0
 * @returns
 */
const ProfileModal = ({ profile, setShowProfileModal }) => {
  const [error, setError] = useState(null)
  const [isPending, setIsPending] = useState(false)
  const [tags, setTags] = useState({ list: JSON.parse(profile.tags) || [] })
  const [links, setLinks] = useState({ list: JSON.parse(profile.links) || [] })
  const [activeChain, setActiveChain] = useState()
  const { address, isConnected } = useConnection()

  // Refs
  const pfpRef = useRef()
  const tagRef = useRef()
  const linkNameRef = useRef()
  const linkURLRef = useRef()

  /* Error during submission (e.g., user rejected)  */
  const { data: hash, isPending: isSigning, error: submitError, writeContract } = useWriteContract()
  /* Error after mining (e.g., transaction reverted) */
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isConnected) return

    setIsPending(true)

    const formData = new FormData(e.target)
    const name = formData.get('name')
    const description = formData.get('description')
    formData.set('tags', JSON.stringify(tags.list))
    formData.set('links', JSON.stringify(links.list))
    const errors = {}

    updateProfile(formData, address).then((res) => {
      if (res.success) {
        setIsPending(false)
        toast(`Your profile has been updated.`, 'success')
      }
    })
  }

  const showPFP = (e) => {
    const preview = pfpRef.current

    const file = e.target.files[0]
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      // convert image file to base64 string
      preview.src = reader.result
    })

    if (file) {
      reader.readAsDataURL(file)
    }
  }

  const addTag = (e) => {
    const newTag = tagRef.current.value
    if (newTag === '') return

    const isReduntant = tags.list.filter((filterItem) => filterItem === newTag)
    if (isReduntant.length === 0) setTags({ list: tags.list.concat(newTag) })
    tagRef.current.value = null
  }

  const removeTag = (e, tag) => {
    setTags({ list: tags.list.filter((filterItem) => filterItem !== tag) })
  }

  const addLink = (e) => {
    const newLinkName = linkNameRef.current.value
    const newLinkURL = linkURLRef.current.value
    if (newLinkName === '' || newLinkURL === '') return

    const isReduntant = links.list.filter((filterItem) => filterItem.name === newLinkName)
    if (isReduntant.length === 0)
      setLinks({ list: links.list.concat({ name: newLinkName, url: newLinkURL }) })
    linkNameRef.current.value = null
    linkURLRef.current.value = null
  }

  const removeLink = (e, link) => {
    setLinks({ list: links.list.filter((filterItem) => filterItem !== link) })
  }

  useEffect(() => {
    setActiveChain(getActiveChain())
    // getStatus(addr).then((res) => {
    //   console.log(res)
    //   setStatus(res)
    // })
  }, [])
  return (
    <>
      <div
        className={`${styles.profileModal} animate fade`}
        onMouseDown={() => setShowProfileModal(false)}
      >
        <div className={`${styles.profileModal__card}`} onMouseDown={(e) => e.stopPropagation()}>
          <header className={``}>
            <div className={``} aria-label="Close" onClick={() => setShowProfileModal(false)}>
              <svg
                class="x1lliihq x1n2onr6 x5n08af"
                fill="currentColor"
                height="16"
                role="img"
                viewBox="0 0 24 24"
                width="16"
              >
                <title>Close</title>
                <line
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  x1="21"
                  x2="3"
                  y1="3"
                  y2="21"
                ></line>
                <line
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  x1="21"
                  x2="3"
                  y1="21"
                  y2="3"
                ></line>
              </svg>
            </div>
            <div className={`flex-1`}>
              <h3>Update profile</h3>
            </div>
            <div className={`pointer`}></div>
          </header>

          <main className={`flex flex-column align-items-center gap-1 `}>
            {isConfirmed && <p className="text-center badge badge-success">Done</p>}
            <form
              className={`form`}
              action=""
              onSubmit={(e) => handleSubmit(e)}
              encType={`multipart/form-data`}
            >
              <div className={`form-group`}>
                <figure className={`rounded`}>
                  <img ref={pfpRef} src={`${profile.profileImage}`} />
                </figure>
              </div>
              <div className={`form-group`}>
                <label htmlFor="">Profile picture</label>
                <input type="file" name="profileImage" id="" onChange={(e) => showPFP(e)} />
                <input
                  type="hidden"
                  name="profileImage_hidden"
                  defaultValue={profile.profileImageName}
                />
              </div>
              <div className={`form-group`}>
                <label htmlFor="">Name</label>
                <input
                  type="text"
                  name="name"
                  id=""
                  defaultValue={profile.name}
                  placeholder={`Name`}
                />
              </div>
              <div className={`form-group`}>
                <label htmlFor="">Bio</label>
                <textarea
                  name="description"
                  id=""
                  defaultValue={profile.description}
                  placeholder="Profile bio"
                ></textarea>
              </div>

              <details open>
                <summary>Advanced</summary>
                <div>
                  <div>
                    <div className={`flex flex-wrap`}>
                      {tags.list.length > 0 &&
                        tags.list.map((tag, i) => (
                          <>
                            <span key={i} className={`${styles['form-tag']}`}>
                              {tag}
                              <button type="button" onClick={(e) => removeTag(e, tag)}>
                                X
                              </button>
                            </span>
                          </>
                        ))}
                    </div>

                    <div className={`form-group flex`}>
                      <input ref={tagRef} type="text" name="tags" id="" placeholder={`Tag`} />
                      <button type="button" onClick={(e) => addTag(e)}>
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className={`flex flex-wrap`}>
                      {links.list.length > 0 &&
                        links.list.map((link, i) => (
                          <>
                            <span key={i} className={`${styles['form-link']}`}>
                              {link.name}
                              <button type="button" onClick={(e) => removeLink(e, link)}>
                                X
                              </button>
                            </span>
                          </>
                        ))}
                    </div>

                    <div className={`form-group flex`}>
                      <input
                        ref={linkNameRef}
                        type="text"
                        name="links"
                        id=""
                        placeholder={`Link Name`}
                      />
                      <input
                        ref={linkURLRef}
                        type="text"
                        name="links"
                        id=""
                        placeholder={`Link URL`}
                      />
                      <button type="button" onClick={(e) => addLink(e)}>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              <div className={`form-group`}>
                <button type="submit" className="btn" disabled={isPending}>
                  Update
                </button>
                {error && <p>{error}</p>}
              </div>
            </form>
          </main>
        </div>
      </div>
    </>
  )
}