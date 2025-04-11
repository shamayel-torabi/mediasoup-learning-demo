import { Card } from "~/components/Card";
import { Form, Link, redirect } from "react-router";
import { z, type ZodFormattedError } from "zod";
import { Errors } from "~/components/Errors";
import type { Route } from "./+types/_auth.register";

const registerUserSchema = z.object({
    email: z.string({ required_error: "ریانامه باید وارد شود" })
        .email({ message: "نشانی رایانامه معتبر نمی باشد" }),
    firstName: z.string({ required_error: "نام باید وارد شود" })
        .min(1, { message: "نام باید بیش از یک حرف باشد" }),
    lastName: z.string({ required_error: "نام باید وارد شود" })
        .min(1, { message: "نام باید بیش از یک حرف باشد" }),
    password: z.string({ required_error: "گذرواژه  باید وارد شود" })
        .min(4, { message: "گذرواژه باید بیش از چهار حرف باشد" }),
    confirmPassword: z.string({ required_error: "تکرار گذرواژه باید وارد شود" })
        .min(4, { message: "تکرار گذرواژه باید بیش از چهار حرف باشد" }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "گذرواژه ها برابر نیستند",
    path: ["confirmPassword"],
});


type ActionProps = {
    errors?: ZodFormattedError<{
        email: string;
        firstName: string;
        lastName: string;
        password: string;
        confirmPassword: string;
        customError: string;
    }, string> | undefined
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "ثبت نام کاربر" },
        { name: "description", content: "Video Conferencing App" },
    ];
}

export async function clientAction({ request }: Route.ClientActionArgs) {
    const formData = await request.formData();

    const result = registerUserSchema.safeParse({
        email: formData.get("email") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        password: formData.get("password") as string,
        confirmPassword: formData.get("confirmPassword") as string
    });

    if (!result.success) {
        return {
            errors: result.error.format()
        };
    }

    const { email, firstName, lastName, password } = result.data
    console.log(result.data)
    try {
        const role = 'user'
        const respons = await fetch('http://127.0.0.1:3031/api/auth/register', {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password, role, firstName, lastName }),
        })

        if (respons.ok) {
            const { user } = await respons.json();
            console.log('registered user:',user)
            return redirect('/login');
        }
        else {
            const { error } = await respons.json();
            return {
                errors: {
                    _errors: [],
                    customError: {
                        _errors: [error]
                    }
                }
            };
        }

    } catch (error) {
        console.log(error)
        return {
            errors: {
                _errors: [],
                customError: {
                    _errors: [error]
                }
            }
        };
    }
}

export default function Register({ actionData }: Route.ComponentProps) {

    return (
        <section className="grid items-center justify-center h-screen">
            <Card className="grid grid-cols-1 md:grid-cols-2 gap-4 w-sm md:w-[47rem]">
                <Card className="min-h-96">
                    <h1 className="text-3xl text-gray-900 dark:text-white mb-10">ثبت نام کاربر</h1>
                    <Form method="post">
                        <div className="mb-5 grid grid-cols-2 gap-1" >
                            <div>
                                <label htmlFor="firstName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">نام</label>
                                <input
                                    id="firstName"
                                    name="firstName"
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    placeholder="نام" />
                                <Errors errors={actionData?.errors?.firstName?._errors} />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">نام خانوادگی</label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                    placeholder="نام خانوادگی" />
                                <Errors errors={actionData?.errors?.lastName?._errors} />
                            </div>
                        </div>

                        <div className="mb-5" >
                            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">رایانامه</label>
                            <input
                                dir="ltr"
                                type="email" id="email"
                                name="email"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                                placeholder="رایانامه" />
                            <Errors errors={actionData?.errors?.email?._errors} />
                        </div>
                        <div className="mb-5">
                            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">گذرواژه</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                            />
                            <Errors errors={actionData?.errors?.password?._errors} />

                        </div>
                        <div className="mb-5">
                            <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">تکرار گذرواژه</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                            />
                            <Errors errors={actionData?.errors?.confirmPassword?._errors} />

                        </div>
                        <div>
                            <Errors errors={actionData?.errors?.customError?._errors} />
                        </div>
                        <div className='flex justify-end'>
                            <button type="submit" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">ارسال</button>
                        </div>
                    </Form>
                </Card>
                <Card className="min-h-96">
                    <div className="flex flex-col justify-between h-full">
                        <div className="flex flex-col justify-between">
                            <svg className="h-48 text-gray-900 dark:text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 117.85">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M108,96.63l12.88,13.06v6.14h-6.09v-4.62h-5.06v-5h-4.83l-1.4-4.55A14.08,14.08,0,0,1,95.63,104a13.32,13.32,0,1,1,13.8-13.31,12.87,12.87,0,0,1-1.47,6ZM95,62.12a27.85,27.85,0,0,1,26.22,37.27l-4.55-4.61a22.2,22.2,0,0,0-39-18.63l-.1.13,0,0,0,0-.24.31h0l-.12.17-.14.19-.13.18-.13.19-.1.14,0,.05-.13.19-.12.19v0l-.11.17-.12.2,0,.08-.07.11-.12.2-.09.15,0,0-.12.2-.11.2v0l-.09.18-.11.2,0,.1-.06.11-.1.2-.08.17,0,0-.1.21-.09.2,0,0L74.7,81l-.09.22,0,.1,0,.11-.09.21-.07.18v0l-.09.21-.08.22v0l-.07.18-.07.22,0,.11L74,83l-.11.34,0,.07v0l-.07.22-.06.23,0,0,0,.17-.06.23,0,.12,0,.1-.1.4V85h0l-.1.45v.06l0,.17,0,.23,0,.14,0,.1-.06.38v.09l0,.23,0,.24v.06l0,.18,0,.23v.24l0,.42v0h0l0,.24,0,.24v.13l0,.36v1.3h0v.67l0,.42v.06h0l0,.54v0l0,.28,0,.25v0l.07.46v.1l0,.27,0,.24v0l.1.48v.07l.06.27,0,.22v.06l.07.27,0,.21v.06l.08.26.07.27.08.26v.05l.07.22.08.26.07.19,0,.07.09.26.07.18,0,.08.09.25.1.26.11.25.07.17,0,.08.11.26.11.24.12.25.07.15,0,.1.12.24h0c.2.4.42.79.64,1.18l.14.24.14.23.14.23.15.22.15.23.07.11.08.11h0c.41.59.84,1.16,1.3,1.71l.18.21.17.2h0c.23.27.48.52.72.78l.19.19.06.07.13.12A22.14,22.14,0,0,0,95,112.18a22.78,22.78,0,0,0,4.7-.5,7.64,7.64,0,0,0,2.73,1.63,7.44,7.44,0,0,0,1.69,3,27.82,27.82,0,0,1-28.82-6.63l-.33-.35a27.29,27.29,0,0,1-2.89-3.53H0C0,74,28.69,85.5,40.31,69.53c1.34-2,1-1.82-.52-3.42a18.41,18.41,0,0,1-1.61-1.93c-3.1-4.25-5.88-9.06-8.68-13.53-2-3-3.09-5.65-3.09-7.78s1.21-4.93,3.62-5.53a120.24,120.24,0,0,1-.21-14,19.64,19.64,0,0,1,.64-3.51,20.3,20.3,0,0,1,9-11.51A23.11,23.11,0,0,1,44.41,6c3.09-1.17,1.6-5.86,5-6,8-.21,21.09,6.61,26.2,12.15a20.15,20.15,0,0,1,5.22,13.1l-.32,12.62a3.94,3.94,0,0,1,2.88,2.87c.42,1.71,0,4-1.49,7.35h0c0,.11-.11.11-.11.22C78.51,53.73,75.1,60,71.32,65c-1.9,2.53-3.46,2.08-1.84,4.51a19.81,19.81,0,0,0,3.37,3.57,26.52,26.52,0,0,1,2.47-2.82l.35-.32A27.72,27.72,0,0,1,95,62.12ZM93.64,86.39a2.46,2.46,0,1,1-2.46,2.46,2.47,2.47,0,0,1,2.46-2.46Z" />
                            </svg>
                            <p className="mt-8 text-gray-900 dark:text-white">
                                اگر در این وبگاه حساب کاربری دارید با کلیک دکمه ورود به وبگاه وارد شوید
                            </p>
                        </div>
                        <div className='flex justify-end'>
                            <Link to="/login">
                                <button className="text-gray-900 dark:text-white border-0 cursor-pointer" tabIndex={-1}>
                                    ورود
                                </button>
                            </Link>
                        </div>
                    </div>
                </Card>
            </Card>
        </section>
    )
}
