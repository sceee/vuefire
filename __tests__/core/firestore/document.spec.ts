import firebase from 'firebase'
import { bindDocument } from '../../../src/core'
import {
  spyUnbind,
  createOps,
  initFirebase,
  generateRandomID,
  delay,
} from '../../src'
import * as firestore from '@firebase/firestore-types'
import { OperationsType } from '../../../src/shared'
import { ref, Ref } from 'vue'

beforeAll(() => {
  initFirebase()
})

describe('documents', () => {
  let collection: firestore.CollectionReference,
    document: firestore.DocumentReference,
    target: Ref<Record<string, any>>,
    resolve: (data: any) => void,
    reject: (error: any) => void,
    ops: OperationsType

  beforeEach(async () => {
    collection = firebase.firestore().collection(generateRandomID())
    document = collection.doc()

    ops = createOps()
    target = ref({})
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindDocument(target, document, ops, resolve, reject)
    })

    await delay(200)
  })

  it('does not call anything if document does not exist', () => {
    expect(ops.add).not.toHaveBeenCalled()
    expect(ops.set).toHaveBeenCalled()
    expect(ops.set).toHaveBeenCalledWith(target, 'value', null)
    expect(ops.remove).not.toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
  })

  it('binding to a non-existant document sets the property to null', async () => {
    // @ts-ignore
    target.value = 'foo'
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindDocument(target, collection.doc(), ops, resolve, reject)
    })
    expect(target.value).toBe(null)
    expect(resolve).toHaveBeenCalledWith(null)
  })

  it('updates a document', async () => {
    await document.set({ foo: 'foo' })
    expect(ops.add).not.toHaveBeenCalled()
    expect(ops.set).toHaveBeenCalledTimes(2)
    expect(ops.set).toHaveBeenLastCalledWith(target, 'value', { foo: 'foo' })
    expect(ops.remove).not.toHaveBeenCalled()
    await document.update({ bar: 'bar' })
    expect(ops.set).toHaveBeenCalledTimes(3)
    expect(ops.set).toHaveBeenLastCalledWith(target, 'value', {
      bar: 'bar',
      foo: 'foo',
    })
  })

  it('sets to null when deleted', async () => {
    await document.set({ foo: 'foo' })
    await document.delete()
    expect(target.value).toBe(null)
  })

  it('adds non-enumerable id', async () => {
    const docID = generateRandomID()
    document = collection.doc(docID)
    bindDocument(target, document, ops, resolve, reject)
    await document.set({ foo: 'foo' })
    expect(Object.getOwnPropertyDescriptor(target.value, 'id')).toEqual({
      configurable: false,
      enumerable: false,
      writable: false,
      value: docID,
    })
  })

  it('manually unbinds a document', async () => {
    document = collection.doc()
    await document.set({ foo: 'foo' })
    const unbindSpy = spyUnbind(document)
    let unbind: () => void = () => {
      throw new Error('Promise was not called')
    }
    await new Promise((resolve, reject) => {
      unbind = bindDocument(target, document, ops, resolve, reject)
    })

    expect(unbindSpy).not.toHaveBeenCalled()
    expect(target.value).toEqual({ foo: 'foo' })
    unbind()
    expect(unbindSpy).toHaveBeenCalled()

    // reset data manually
    // @ts-ignore
    target.value = null
    await document.update({ foo: 'foo' })
    expect(target.value).toEqual(null)
    unbindSpy.mockRestore()
  })

  it('rejects when errors', async () => {
    const fakeOnSnapshot = (_: any, fail: (err: Error) => void) => {
      fail(new Error('nope'))
    }
    document = collection.doc()
    // @ts-ignore
    document.onSnapshot = jest.fn(fakeOnSnapshot)
    await expect(
      new Promise((resolve, reject) => {
        bindDocument(target, document, ops, resolve, reject)
      })
    ).rejects.toThrow()
    // @ts-ignore
    document.onSnapshot.mockRestore()
  })

  it('resolves when the document is set', async () => {
    await document.set({ foo: 'foo' })
    const promise = new Promise((resolve, reject) => {
      bindDocument(target, document, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual({ foo: 'foo' })
  })

  it('resets the value when unbinding', async () => {
    await document.set({ foo: 'foo' })
    let unbind: ReturnType<typeof bindDocument> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindDocument(target, document, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual({ foo: 'foo' })
    unbind()
    expect(target.value).toEqual(null)
  })

  it('can be left as is with reset: false', async () => {
    await document.set({ foo: 'foo' })
    let unbind: ReturnType<typeof bindDocument> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindDocument(target, document, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual({ foo: 'foo' })
    unbind(false)
    expect(target.value).toEqual({ foo: 'foo' })
  })

  it('can be reset to a specific value', async () => {
    await document.set({ foo: 'foo' })
    let unbind: ReturnType<typeof bindDocument> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindDocument(target, document, ops, resolve, reject)
    })
    await promise
    expect(target.value).toEqual({ foo: 'foo' })
    unbind(() => ({ bar: 'bar' }))
    expect(target.value).toEqual({ bar: 'bar' })
  })

  it('ignores reset option in bind when calling unbind', async () => {
    await document.set({ foo: 'foo' })
    let unbind: ReturnType<typeof bindDocument> = () => {
      throw new Error('Promise was not called')
    }
    const promise = new Promise((resolve, reject) => {
      unbind = bindDocument(target, document, ops, resolve, reject, {
        reset: false,
      })
    })
    await promise
    expect(target.value).toEqual({ foo: 'foo' })
    unbind()
    expect(target.value).toEqual(null)
  })
})
