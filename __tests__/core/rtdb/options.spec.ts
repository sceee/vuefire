import { ref, Ref } from 'vue'
import firebase from 'firebase/app'
import {
  rtdbBindAsObject,
  rtdbBindAsArray,
  rtdbOptions,
} from '../../../src/core'
import { createOps, generateRandomID, initFirebase } from '../../src'

beforeAll(() => {
  initFirebase()
})

describe('RTDB options', () => {
  let collection: firebase.database.Reference,
    document: firebase.database.Reference,
    target: Ref<Record<string, any>>,
    unbind: () => void
  const ops = createOps()
  beforeEach(async () => {
    collection = firebase.database().ref(generateRandomID())
    document = firebase.database().ref(generateRandomID())
    target = ref({})
  })

  afterEach(() => {
    unbind && unbind()
  })

  it('allows customizing serialize when calling bindDocument', async () => {
    const spy = jest.fn(() => ({ bar: 'foo' }))
    await new Promise((resolve, reject) => {
      unbind = rtdbBindAsObject(
        {
          target,
          document,
          resolve,
          reject,
          ops,
        },
        { serialize: spy }
      )
      //// document.flush()
    })
    await document.set({ foo: 'foo' })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(target.value).toEqual({ bar: 'foo' })
  })

  it('allows customizing serialize when calling bindCollection', async () => {
    const spy = jest.fn(() => ({ bar: 'foo' }))

    await new Promise((resolve, reject) => {
      unbind = rtdbBindAsArray(
        {
          target,
          collection,
          resolve,
          reject,
          ops,
        },
        { serialize: spy }
      )
      // collection.flush()
    })
    await collection.push({ foo: 'foo' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(target.value).toEqual([{ bar: 'foo' }])
  })

  it('can set options globally for bindDocument', async () => {
    const { serialize } = rtdbOptions
    const spy = jest.fn(() => ({ bar: 'foo' }))
    rtdbOptions.serialize = spy

    await new Promise((resolve, reject) => {
      unbind = rtdbBindAsObject(
        {
          target,
          document,
          resolve,
          reject,
          ops,
        },
        { serialize: spy }
      )
      //// document.flush()
    })
    await document.set({ foo: 'foo' })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(target.value).toEqual({ bar: 'foo' })
    // restore it
    rtdbOptions.serialize = serialize
  })

  it('can set options globally for bindCollection', async () => {
    const { serialize } = rtdbOptions
    const spy = jest.fn(() => ({ bar: 'foo' }))
    rtdbOptions.serialize = spy

    await new Promise((resolve, reject) => {
      unbind = rtdbBindAsArray(
        {
          target,
          collection,
          resolve,
          reject,
          ops,
        },
        { serialize: spy }
      )
      // collection.flush()
    })
    await collection.push({ foo: 'foo' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toBeCalledWith(
      expect.objectContaining({ val: expect.any(Function) })
    )
    expect(target.value).toEqual([{ bar: 'foo' }])
    // restore it
    rtdbOptions.serialize = serialize
  })
})
