import firebase from 'firebase'
import { firestorePlugin } from '../../../src'
import * as firestore from '@firebase/firestore-types'
import { mount } from '@vue/test-utils'
import { initFirebase } from '../../src'

beforeAll(() => {
  initFirebase()
})

// FIXME: implement merging strategies
describe.skip('Firestore: option merging', () => {
  function createMixins() {
    const a1: firestore.CollectionReference = firebase
      .firestore()
      .collection('1')
    const b1: firestore.CollectionReference = firebase
      .firestore()
      .collection('2')
    const a2: firestore.CollectionReference = firebase
      .firestore()
      .collection('3')
    const c2: firestore.CollectionReference = firebase
      .firestore()
      .collection('4')
    const a3: firestore.CollectionReference = firebase
      .firestore()
      .collection('5')
    const c3: firestore.CollectionReference = firebase
      .firestore()
      .collection('6')

    const mWithObjA = {
      firestore: {
        a: a1,
        b: b1,
      },
    }

    const mWithObjB = {
      firestore: {
        a: a2,
        c: c2,
      },
    }

    const mWithFn = {
      firestore() {
        return {
          a: a3,
          c: c3,
        }
      },
    }

    return { mWithFn, mWithObjA, mWithObjB }
  }

  function factory(options: any) {
    return mount(
      {
        template: 'no',
        ...options,
      },
      {
        global: {
          plugins: [firestorePlugin],
        },
      }
    )
  }

  it('should merge properties', () => {
    const { mWithObjA, mWithObjB } = createMixins()
    const { vm } = factory({ mixins: [mWithObjA, mWithObjB] })
    expect(vm.$firestoreRefs.a).toBe(mWithObjB.firestore.a)
    expect(vm.$firestoreRefs.b).toBe(mWithObjA.firestore.b)
    expect(vm.$firestoreRefs).toEqual({
      a: firebase.firestore().collection('3'),
      b: firebase.firestore().collection('2'),
      c: firebase.firestore().collection('4'),
    })
  })

  it('supports function syntax', () => {
    const { mWithFn } = createMixins()
    const { vm } = factory({ mixins: [mWithFn] })
    expect(vm.$firestoreRefs).toEqual({
      a: firebase.firestore().collection('5'),
      c: firebase.firestore().collection('6'),
    })
  })

  it('should merge two functions', () => {
    const { mWithFn, mWithObjA, mWithObjB } = createMixins()
    const { vm } = factory({ mixins: [mWithObjA, mWithObjB, mWithFn] })
    expect(vm.$firestoreRefs).toEqual({
      a: firebase.firestore().collection('5'),
      b: firebase.firestore().collection('2'),
      c: firebase.firestore().collection('6'),
    })
  })
})
