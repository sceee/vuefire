import firebase from 'firebase'
import { bindCollection } from '../../../src/core'
import {
  createOps,
  delay,
  generateRandomID,
  initFirebase,
  spyUnbind,
} from '../../src'
import * as firestore from '@firebase/firestore-types'
import { OperationsType } from '../../../src/core'
import { ref, Ref } from 'vue'

beforeAll(() => {
  initFirebase()
})

describe('collections', () => {
  let collection: firestore.CollectionReference,
    target: Ref<Record<string, any>>,
    resolve: (data: any) => void,
    reject: (error: any) => void,
    ops: OperationsType,
    unbind: ReturnType<typeof bindCollection>

  beforeEach(async () => {
    collection = firebase.firestore().collection(generateRandomID())
    target = ref({})
    ops = createOps()
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      unbind = bindCollection(target, collection, ops, resolve, reject)
    })
  })

  it('initialise the array', () => {
    expect(ops.set).toHaveBeenCalledTimes(1)
    expect(ops.set).toHaveBeenCalledWith(target, 'value', [])
  })

  it('add elements', async () => {
    await collection.add({ text: 'foo' })
    await delay(200)

    expect(ops.add).toHaveBeenCalledTimes(1)
    expect(ops.add).toHaveBeenLastCalledWith(target.value, 0, {
      text: 'foo',
    })
    await collection.add({ text: 'bar' })
    await delay(200)

    expect(ops.add).toHaveBeenCalledTimes(2)
    expect(ops.add).toHaveBeenLastCalledWith(target.value, 0, {
      text: 'bar',
    })
  })

  it('deletes items', async () => {
    await collection.add({ text: 'foo' })
    await collection.doc(target.value[0].id).delete()
    expect(ops.remove).toHaveBeenCalledTimes(1)
    expect(ops.remove).toHaveBeenLastCalledWith(target.value, 0)
  })

  it('update items', async () => {
    const doc = await collection.add({ text: 'foo', more: true })
    await doc.update({ text: 'bar' })
    expect(ops.set).toHaveBeenCalledTimes(1)
    expect(ops.set).toHaveBeenLastCalledWith(target, 'value', [
      { more: true, text: 'bar' },
    ])
  })

  it('add properties', async () => {
    const doc = await collection.add({ text: 'foo' })
    await doc.update({ other: 'bar' })
    expect(ops.set).toHaveBeenCalledTimes(1)
    expect(ops.set).toHaveBeenLastCalledWith(target, 'value', [
      { other: 'bar', text: 'foo' },
    ])
  })

  it('can bind arrays with null', async () => {
    await collection.add({ array: [2, null] })
    expect(ops.set).toHaveBeenCalledTimes(1)
    expect(ops.set).toHaveBeenLastCalledWith(target, 'value', [
      { array: [2, null] },
    ])
  })

  // TODO move to vuefire
  it.skip('unbinds when the instance is destroyed', async () => {
    expect(target.value._firestoreUnbinds).toBeTruthy()
    expect(target.value.items).toEqual([])
    const spy = jest.spyOn(target.value._firestoreUnbinds, 'items')
    expect(() => {
      target.value.$destroy()
    }).not.toThrow()
    expect(spy).toHaveBeenCalled()
    expect(target.value._firestoreUnbinds).toBe(null)
    await expect(async () => {
      await collection.add({ text: 'foo' })
      expect(target.value.items).toEqual([])
    }).not.toThrow()
  })

  it('adds non-enumerable id', async () => {
    const a = collection.doc('u0')
    const b = collection.doc('u1')
    await a.set({})
    await b.set({})
    expect(target.value.length).toBe(2)
    target.value.forEach((item: Record<string, any>, i: number) => {
      expect(Object.getOwnPropertyDescriptor(item, 'id')).toEqual({
        configurable: false,
        enumerable: false,
        writable: false,
        value: `u${i}`,
      })
    })
  })

  it('manually unbinds a collection', async () => {
    collection = firebase.firestore().collection(generateRandomID())
    await collection.add({ text: 'foo' })
    const unbindSpy = spyUnbind(collection)
    let unbind: () => void = () => {
      throw new Error('Promise was not called')
    }
    await new Promise((resolve, reject) => {
      unbind = bindCollection(target, collection, ops, resolve, reject)
    })

    expect(unbindSpy).not.toHaveBeenCalled()
    expect(target.value).toEqual([{ text: 'foo' }])
    unbind()
    expect(unbindSpy).toHaveBeenCalled()

    // reset data manually
    const expected = target.value
    await collection.add({ text: 'bar' })
    // still old version
    expect(target.value).toEqual(expected)
    unbindSpy.mockRestore()
  })

  it('rejects when errors', async () => {
    const fakeOnSnapshot = (_: any, fail: (error: Error) => void) => {
      fail(new Error('nope'))
    }

    collection = firebase.firestore().collection(generateRandomID())
    // @ts-ignore
    collection.onSnapshot = jest.fn(fakeOnSnapshot)
    await expect(
      new Promise((resolve, reject) => {
        bindCollection(target, collection, ops, resolve, reject)
      })
    ).rejects.toThrow()
    // @ts-ignore
    collection.onSnapshot.mockRestore()
  })

  it('resolves when the collection is populated', async () => {
    await collection.add({ foo: 'foo' })
    await collection.add({ foo: 'foo' })
    const promise = new Promise((resolve, reject) => {
      bindCollection(target, collection, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual([{ foo: 'foo' }, { foo: 'foo' }])
  })

  it('resets the value when unbinding', async () => {
    await collection.add({ foo: 'foo' })
    let unbind: () => void = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindCollection(target, collection, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual([{ foo: 'foo' }])
    unbind()
    expect(target.value).toEqual([])
  })

  it('can be left as is with reset: false', async () => {
    await collection.add({ foo: 'foo' })
    let unbind: ReturnType<typeof bindCollection> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindCollection(target, collection, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual([{ foo: 'foo' }])
    unbind(false)
    expect(target.value).toEqual([{ foo: 'foo' }])
  })

  it('can be reset to a specific value', async () => {
    await collection.add({ foo: 'foo' })
    let unbind: ReturnType<typeof bindCollection> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindCollection(target, collection, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual([{ foo: 'foo' }])
    unbind(() => [{ bar: 'bar' }, { baz: 'baz' }])
    expect(target.value).toEqual([{ bar: 'bar' }, { baz: 'baz' }])
  })

  it('ignores reset option in bind when calling unbind', async () => {
    const other = firebase.firestore().collection(generateRandomID())
    await other.add({ a: 0 })
    await other.add({ b: 1 })

    await new Promise((resolve, reject) => {
      unbind = bindCollection(target, other, ops, resolve, reject, {
        reset: false,
      })
    })
    expect(target.value).toHaveLength(2)
    expect(target.value).toEqual(expect.arrayContaining([{ a: 0 }, { b: 1 }]))
    unbind()
    expect(target.value).toEqual([])
  })

  it('can wait until ready', async () => {
    await collection.add({ foo: 'foo' })
    await collection.add({ foo: 'foo' })
    expect(target.value).toEqual([{ foo: 'foo' }, { foo: 'foo' }])

    const other = firebase.firestore().collection(generateRandomID())

    // force the unbind without resetting the value
    unbind(false)
    const promise = new Promise((resolve, reject) => {
      bindCollection(target, other, ops, resolve, reject, { wait: true })
    })
    expect(target.value).toEqual([{ foo: 'foo' }, { foo: 'foo' }])
    await promise
    expect(target.value).toEqual([])
    // we can add other stuff
    await other.add({ a: 0 })
    await other.add({ b: 1 })

    expect(target.value).toHaveLength(2)
    expect(target.value).toEqual(expect.arrayContaining([{ a: 0 }, { b: 1 }]))
  })

  it('sets the value to an empty array even with no documents', async () => {
    // @ts-ignore
    target.value = 'foo'
    await new Promise((resolve, reject) => {
      bindCollection(
        target,
        firebase.firestore().collection(generateRandomID()) as any,
        ops,
        resolve,
        reject,
        {
          wait: true,
        }
      )
    })
    expect(target.value).toEqual([])
  })

  it('can wait until ready with empty arrays', async () => {
    expect(target.value).toEqual([])
    expect(resolve).toHaveBeenCalledWith([])

    const other = firebase.firestore().collection(generateRandomID())
    await other.add({ a: 0 })
    await other.add({ b: 1 })

    // force the unbind without resetting the value
    unbind(false)
    const promise = new Promise((resolve, reject) => {
      bindCollection(target, other, ops, resolve, reject, { wait: true })
    })
    expect(target.value).toEqual([])
    await promise
    expect(target.value).toHaveLength(2)
    expect(target.value).toEqual(expect.arrayContaining([{ a: 0 }, { b: 1 }]))
  })
})
