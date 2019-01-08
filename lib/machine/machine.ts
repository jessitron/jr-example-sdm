/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    AutoCodeInspection,
    onAnyPush,
    goals,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import { inspectClientGetOutsideOfTry } from "./clientGetOutsideOfTry";

/**
 * Initialize an sdm definition, and add functionality to it.
 *
 * @param configuration All the configuration for this service
 */
export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine({
        name: "Empty Seed Software Delivery Machine",
        configuration,
    });

    const codeInspect = new AutoCodeInspection();
    codeInspect.with({
        name: "no client.get outside of try/catch ",
        inspection: inspectClientGetOutsideOfTry,
    });

    sdm.withPushRules(onAnyPush().setGoals(goals("stuff").plan(codeInspect)));

    /*
     * this is a good place to type
    sdm.
     * and see what the IDE suggests for after the dot
     */

    return sdm;
}
