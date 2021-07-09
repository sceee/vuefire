import firebase from 'firebase'
import {
  bindDocument,
  firestoreOptions,
  bindCollection,
} from '../../../src/core'
import { createOps, generateRandomID, initFirebase } from '../../src'
import * as firestore from '@firebase/firestore-types'
import { Ref, ref } from 'vue'

beforeAll(() => {
  initFirebase()
})

describe('options', () => {
  let collection: firestore.CollectionReference,
    document: firestore.DocumentReference,
    target: Ref<Record<string, any>>,
    resolve: (data: any) => void,
    reject: (error: any) => void
  const ops = createOps()

  beforeEach(async () => {
    collection = firebase.firestore().collection(generateRandomID())
    document = collection.doc()
    target = ref({})
    await document.set({ foo: 'foo' })
  })

  it('allows customizing serialize when calling bindDocument', async () => {
    const spy = jest.fn(() => ({ bar: 'foo' }))
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindDocument(target, document, ops, resolve, reject, { serialize: spy })
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(target.value).toEqual({ bar: 'foo' })
  })

  it('allows customizing serialize when calling bindCollection', async () => {
    const spy = jest.fn(() => ({ bar: 'foo' }))
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindCollection(target, collection, ops, resolve, reject, {
        serialize: spy,
      })
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(target.value).toEqual([{ bar: 'foo' }])
  })

  it('can set options globally for bindDocument', async () => {
    const { serialize } = firestoreOptions
    const spy = jest.fn(() => ({ bar: 'foo' }))
    firestoreOptions.serialize = spy
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindDocument(target, document, ops, resolve, reject)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(target.value).toEqual({ bar: 'foo' })
    // restore it
    firestoreOptions.serialize = serialize
  })

  it('can set options globally for bindCollection', async () => {
    const { serialize } = firestoreOptions
    const spy = jest.fn(() => ({ bar: 'foo' }))
    firestoreOptions.serialize = spy
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindCollection(target, collection, ops, resolve, reject)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ data: expect.any(Function) })
    )
    expect(target.value).toEqual([{ bar: 'foo' }])
    // restore it
    firestoreOptions.serialize = serialize
  })
})
