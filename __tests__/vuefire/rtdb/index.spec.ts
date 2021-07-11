import firebase from 'firebase'
import { mount } from '@vue/test-utils'
import { rtdbPlugin } from '../../../src'
import { generateRandomID, initFirebase, tick } from '../../src'

beforeAll(() => {
  initFirebase()
})

describe('RTDB: firebase option', () => {
  async function createVm() {
    const source = firebase.database().ref(generateRandomID())
    const wrapper = mount(
      {
        template: 'no',
        data: () => ({
          items: [],
          item: null,
        }),
        firebase: {
          items: source,
          item: source,
        },
      },
      {
        global: {
          plugins: [rtdbPlugin],
        },
      }
    )
    await tick()

    return { vm: wrapper.vm, source, wrapper }
  }

  it('does nothing with no firebase', () => {
    const wrapper = mount(
      {
        template: 'no',
        data: () => ({ items: null }),
      },
      { global: { plugins: [rtdbPlugin] } }
    )
    expect(wrapper.vm.items).toEqual(null)
  })

  it('does nothing with empty firebase return', () => {
    const wrapper = mount(
      {
        template: 'no',
        data: () => ({ items: null }),
        // @ts-ignore
        firebase: () => {},
      },
      { global: { plugins: [rtdbPlugin] } }
    )
    // @ts-ignore
    expect(wrapper.vm.items).toEqual(null)
  })

  it('setups $firebaseRefs', async () => {
    const { vm, source } = await createVm()
    expect(Object.keys(vm.$firebaseRefs).sort()).toEqual(['item', 'items'])
    expect(vm.$firebaseRefs.item.key).toBe(source.key)
    expect(vm.$firebaseRefs.items.key).toBe(source.key)
  })

  it('clears $firebaseRefs on $destroy', async () => {
    const { vm, wrapper } = await createVm()
    wrapper.unmount()
    expect(vm.$firebaseRefs).toEqual(null)
  })
})
