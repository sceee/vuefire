import firebase from 'firebase/app'
import { rtdbBindAsArray } from '../../../src/core'
import { createOps, generateRandomID, initFirebase } from '../../src'
import { ResetOption } from '../../../src/shared'
import { ref, Ref } from 'vue'

beforeAll(() => {
  initFirebase()
})

describe('RTDB collection', () => {
  let collection: firebase.database.Reference,
    target: Ref<Record<string, any>>,
    resolve: (data: any) => void,
    reject: (error: any) => void,
    unbind: ReturnType<typeof rtdbBindAsArray>
  const ops = createOps()

  beforeEach(async () => {
    collection = firebase.database().ref(generateRandomID())
    target = ref([])
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      unbind = rtdbBindAsArray({
        target,
        collection,
        resolve,
        reject,
        ops,
      })
      //// collection.flush()
    })
  })

  it('sets a collection', async () => {
    await collection.push({ name: 'one' })
    await collection.push({ name: 'two' })
    await collection.push({ name: 'three' })
    // collection.flush()
    expect(target.value).toEqual([
      { name: 'one' },
      { name: 'two' },
      { name: 'three' },
    ])
  })

  it('removes elements', async () => {
    await collection.push({ name: 'one' })
    await collection.push({ name: 'two' })
    await collection.push({ name: 'three' })
    // collection.flush()
    await collection.child(target.value[1]['.key']).remove()
    // collection.flush()
    expect(target.value).toEqual([{ name: 'one' }, { name: 'three' }])
  })

  it('stops listening to events when unbound', async () => {
    await collection.push({ name: 'one' })
    await collection.push({ name: 'two' })
    await collection.push({ name: 'three' })
    // collection.flush()
    const items = firebase.database().ref(generateRandomID())
    await items.push({ other: 'one' })
    await items.push({ other: 'two' })
    await items.push({ other: 'three' })
    //items.flush()

    unbind()
    await new Promise((resolve, reject) => {
      rtdbBindAsArray({
        target,
        collection: items,
        resolve,
        reject,
        ops,
      })
      //items.flush()
    })

    expect(target.value).toEqual([
      { other: 'one' },
      { other: 'two' },
      { other: 'three' },
    ])
  })

  it('reorder elements', async () => {
    await collection.push({ value: 3 })
    await collection.push({ value: 1 })
    await collection.push({ value: 2 })
    // collection.flush()

    const originalOn = collection.on
    let childChangedCb = jest.fn()
    const mock = jest.spyOn(collection, 'on').mockImplementation(
      // @ts-ignore
      (name, ...args) => {
        if (name === 'child_moved') {
          // @ts-ignore
          childChangedCb = args[0]
          return
        }
        originalOn.call(collection, name, ...args)
      }
    )

    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      rtdbBindAsArray({
        target,
        collection,
        resolve,
        reject,
        ops,
      })
      // collection.flush()
    })

    expect(target.value).toEqual([{ value: 3 }, { value: 1 }, { value: 2 }])

    childChangedCb(
      {
        key: target.value[0]['.key'],
      },
      target.value[2]['.key']
    )

    expect(target.value).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])

    // move to beginning
    childChangedCb(
      {
        key: target.value[1]['.key'],
      },
      null
    )

    expect(target.value).toEqual([{ value: 2 }, { value: 1 }, { value: 3 }])

    mock.mockClear()
  })

  it('updates an item', async () => {
    await collection.push({ name: 'foo' })
    // collection.flush()
    await collection.child(target.value[0]['.key']).set({ name: 'bar' })
    // collection.flush()
    expect(target.value).toEqual([{ name: 'bar' }])
  })

  it('resets the value when unbinding', async () => {
    await collection.push({ name: 'foo' })
    // collection.flush()
    expect(target.value).toEqual([{ name: 'foo' }])
    unbind()
    expect(target.value).toEqual([])
  })

  it('can be left as is reset: false', async () => {
    let unbind: (reset?: ResetOption) => void = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = rtdbBindAsArray({
        target,
        collection,
        resolve,
        reject,
        ops,
      })
      // collection.flush()
    })
    await promise
    await collection.push({ foo: 'foo' })
    // collection.flush()
    expect(target.value).toEqual([{ foo: 'foo' }])
    unbind(false)
    expect(target.value).toEqual([{ foo: 'foo' }])
  })

  it('can be reset to a specific value', async () => {
    let unbind: ReturnType<typeof rtdbBindAsArray> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = rtdbBindAsArray({
        target,
        collection,
        resolve,
        reject,
        ops,
      })
      // collection.flush()
    })
    await promise
    await collection.push({ foo: 'foo' })
    // collection.flush()
    expect(target.value).toEqual([{ foo: 'foo' }])
    unbind(() => [{ bar: 'bar' }])
    expect(target.value).toEqual([{ bar: 'bar' }])
  })

  it('ignores reset option in bind when calling unbind', async () => {
    let unbind: ReturnType<typeof rtdbBindAsArray> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = rtdbBindAsArray(
        { target, collection, resolve, reject, ops },
        // will have no effect when unbinding
        { reset: () => ['Foo'] }
      )
      // collection.flush()
    })
    await promise
    await collection.push({ foo: 'foo' })
    // collection.flush()
    unbind()
    expect(target.value).toEqual([])
  })

  it('can wait until ready', async () => {
    await collection.push({ name: 'one' })
    await collection.push({ name: 'two' })
    // collection.flush()

    const other = firebase.database().ref(generateRandomID())

    expect(target.value).toEqual([{ name: 'one' }, { name: 'two' }])

    // force the unbind without resetting the value
    unbind(false)
    const promise = new Promise((resolve, reject) => {
      rtdbBindAsArray(
        {
          target,
          collection: other,
          resolve,
          reject,
          ops,
        },
        { wait: true }
      )
    })

    expect(target.value).toEqual([{ name: 'one' }, { name: 'two' }])
    //other.flush()
    await promise
    expect(target.value).toEqual([])

    await other.push({ other: 'one' })
    await other.push({ other: 'two' })
    //other.flush()

    expect(target.value).toEqual([{ other: 'one' }, { other: 'two' }])
  })

  it('can wait until ready with empty arrays', async () => {
    expect(target.value).toEqual([])

    const other = firebase.database().ref(generateRandomID())
    await other.push({ a: 0 })
    await other.push({ b: 1 })
    //other.flush()

    unbind(false)
    const promise = new Promise((resolve, reject) => {
      rtdbBindAsArray(
        {
          target,
          collection: other,
          resolve,
          reject,
          ops,
        },
        { wait: true }
      )
    })

    expect(target.value).toEqual([])
    //other.flush()
    await promise
    expect(target.value).toEqual([{ a: 0 }, { b: 1 }])
  })

  it('rejects when errors', async () => {
    const error = new Error()
    const collection = firebase.database().ref(generateRandomID())
    //collection.failNext('once', error)
    const target = ref([])
    await expect(
      new Promise((resolve, reject) => {
        unbind = rtdbBindAsArray({
          target,
          collection,
          resolve,
          reject,
          ops,
        })
        // collection.flush()
      })
    ).rejects.toBe(error)
  })
})
