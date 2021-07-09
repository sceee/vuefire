import firebase from 'firebase'
import 'firebase/firestore'
import 'firebase/database'
import { nextTick } from 'vue-demi'
import { OperationsType, walkSet } from '../../src/core'

// Vue.config.productionTip = false
// Vue.config.devtools = false

type FirestoreReference =
  | firebase.firestore.CollectionReference
  | firebase.firestore.DocumentReference
  | firebase.firestore.Query

export function spyUnbind(ref: FirestoreReference): jest.Mock<any, any> {
  const unbindSpy = jest.fn()
  const onSnapshot = ref.onSnapshot.bind(ref)
  ref.onSnapshot =
    // @ts-ignore
    (fn) => {
      // @ts-ignore
      const unbind = onSnapshot(fn)
      return () => {
        unbindSpy()
        unbind()
      }
    }
  return unbindSpy
}

export function spyOnSnapshot(ref: FirestoreReference) {
  const onSnapshot = ref.onSnapshot.bind(ref)
  // @ts-ignore
  return (ref.onSnapshot = jest.fn((...args) => onSnapshot(...args)))
}

export function spyOnSnapshotCallback(
  ref: FirestoreReference
): jest.Mock<any, any> {
  const onSnapshot = ref.onSnapshot.bind(ref)
  const spy = jest.fn()
  ref.onSnapshot = (fn: any) => {
    console.log(`onSnapshot Called: ${fn}`)
    // @ts-ignore
    return onSnapshot((...args) => {
      spy()
      fn(...args)
    })
  }
  return spy
}

// This makes sure some tests fail by delaying callbacks
export function delayUpdate(
  ref: firebase.firestore.DocumentReference,
  time = 0
) {
  const onSnapshot = ref.onSnapshot.bind(ref)
  ref.onSnapshot = (fn) =>
    onSnapshot(async (...args) => {
      await delay(time)
      if (typeof fn !== 'function') {
        throw new Error('onSnapshot can only be called on function')
      }
      fn(...args)
    })
}

export const tick = nextTick

export function delay(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time))
}

type WalkSet = typeof walkSet
export const createOps = (localWalkSet: WalkSet = walkSet): OperationsType => ({
  add: jest.fn((array, index, data) => {
    //console.log(`Add called: ${data}`)
    array.splice(index, 0, data)
  }),
  set: jest.fn(localWalkSet),
  remove: jest.fn((array, index) => array.splice(index, 1)),
})

export function initFirebase(): void {
  const firebaseConfig = {
    apiKey: '...',
    authDomain: 'vuefire-test.firebaseapp.com',
    projectId: 'vuefire-test',
    storageBucket: 'vuefire-test.appspot.com',
    messagingSenderId: '...',
    appId: '...',
  }
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig)
  firebase.database().useEmulator('localhost', 9000)
  firebase.firestore().useEmulator('localhost', 8080)
}

export function generateRandomID(): string {
  return Math.random().toString(16).slice(2)
}
